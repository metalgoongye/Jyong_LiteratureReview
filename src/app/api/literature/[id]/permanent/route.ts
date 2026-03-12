import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Delete related rows first (FK constraints)
  await supabase.from('literature_content').delete().eq('literature_id', id)
  await supabase.from('empirical_evidence').delete().eq('literature_id', id)
  await supabase.from('batch_literature').delete().eq('literature_id', id)

  // Also delete from storage if there's a file
  const { data: lit } = await supabase
    .from('literature')
    .select('storage_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (lit?.storage_path) {
    await supabase.storage.from('literature-files').remove([lit.storage_path])
  }

  const { error } = await supabase
    .from('literature')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
