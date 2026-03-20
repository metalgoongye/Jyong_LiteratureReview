import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToStorage } from '@/lib/storage/upload'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const storagePath = await uploadFileToStorage(buffer, user.id, id, file.name, file.type || 'application/octet-stream')

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
