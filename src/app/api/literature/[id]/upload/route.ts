import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const BUCKET = 'literature-files'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check with regular client
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: lit } = await supabase
    .from('literature')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!lit) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Use service client to bypass storage RLS for server-side uploads
  const service = await createServiceClient()

  const ext = file.name.split('.').pop() || 'bin'
  const filePath = `${user.id}/${id}/file.${ext}`

  let storagePath: string
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const { error: storageError } = await service.storage
      .from(BUCKET)
      .upload(filePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: true })
    if (storageError) throw new Error(storageError.message)
    storagePath = filePath
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Storage upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const { error } = await supabase
    .from('literature')
    .update({
      storage_path: storagePath,
      original_filename: file.name,
      source_type: 'pdf',
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, storage_path: storagePath })
}
