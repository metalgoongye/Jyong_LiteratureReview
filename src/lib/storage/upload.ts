import { createClient } from '@/lib/supabase/server'

const BUCKET = 'literature-files'

export async function uploadFileToStorage(
  buffer: Buffer,
  userId: string,
  literatureId: string,
  filename: string,
  contentType: string
): Promise<string> {
  const supabase = await createClient()
  const safeFilename = filename.replace(/\s+/g, '_')
  const filePath = `${userId}/${literatureId}/${safeFilename}`

  const { error } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
    contentType,
    upsert: true,
  })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return filePath
}

export async function getSignedUrl(storagePath: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error || !data?.signedUrl) throw new Error('Failed to get signed URL')
  return data.signedUrl
}

export async function downloadFile(storagePath: string): Promise<Buffer> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)

  if (error || !data) throw new Error(`Download failed: ${error?.message}`)
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
