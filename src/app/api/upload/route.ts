import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadFileToStorage } from '@/lib/storage/upload'

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB per file
const MAX_FILES = 10

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contentType = request.headers.get('content-type') || ''

  // Handle URL input
  if (contentType.includes('application/json')) {
    const body = await request.json()
    const { url } = body

    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 })

    // Create literature row for URL
    const { data: lit, error } = await supabase
      .from('literature')
      .insert({
        user_id: user.id,
        source_type: 'url',
        source_url: url,
        extraction_status: 'pending',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Create batch job
    const { data: batch } = await supabase
      .from('batch_jobs')
      .insert({
        user_id: user.id,
        total_files: 1,
        overall_status: 'pending',
      })
      .select()
      .single()

    if (batch) {
      await supabase.from('batch_literature').insert({
        batch_id: batch.id,
        literature_id: lit.id,
        position: 0,
      })
    }

    return NextResponse.json({
      literatureIds: [lit.id],
      batchJobId: batch?.id,
    })
  }

  // Handle file uploads
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }

  // Validate files
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not supported. Use PDF, JPG, or PNG.` },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds 20MB limit` },
        { status: 400 }
      )
    }
  }

  const literatureIds: string[] = []

  // Create batch job
  const { data: batch } = await supabase
    .from('batch_jobs')
    .insert({
      user_id: user.id,
      total_files: files.length,
      overall_status: 'pending',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const sourceType = file.type === 'application/pdf' ? 'pdf' : 'image'

    // Create literature row
    const { data: lit, error: litError } = await supabase
      .from('literature')
      .insert({
        user_id: user.id,
        source_type: sourceType,
        original_filename: file.name,
        extraction_status: 'pending',
      })
      .select()
      .single()

    if (litError || !lit) continue

    try {
      // Upload file to storage
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const storagePath = await uploadFileToStorage(
        buffer,
        user.id,
        lit.id,
        file.name,
        file.type
      )

      // Update with storage path
      await supabase
        .from('literature')
        .update({ storage_path: storagePath })
        .eq('id', lit.id)
    } catch (storageError) {
      const errMsg = storageError instanceof Error ? storageError.message : 'Storage upload failed'
      await supabase.from('literature').update({ extraction_status: 'failed', ai_feedback: errMsg }).eq('id', lit.id)
      return NextResponse.json({ error: `파일 저장 실패: ${errMsg}` }, { status: 500 })
    }

    literatureIds.push(lit.id)

    // Link to batch
    if (batch) {
      await supabase.from('batch_literature').insert({
        batch_id: batch.id,
        literature_id: lit.id,
        position: i,
      })
    }
  }

  return NextResponse.json({
    literatureIds,
    batchJobId: batch?.id,
  })
}
