import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Update user notes (or other user-editable fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}

  const editableFields = [
    'user_notes', 'title', 'year', 'journal_name', 'volume', 'issue',
    'pages', 'publisher', 'country', 'doi', 'abstract', 'language', 'doc_type',
    'storage_path', 'original_filename', 'source_type',
  ]
  for (const field of editableFields) {
    if (field in body) allowed[field] = body[field] ?? null
  }
  // authors is an array — handle separately
  if ('authors' in body) allowed.authors = body.authors?.length ? body.authors : null

  const { error } = await supabase
    .from('literature')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Soft delete
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('literature')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
