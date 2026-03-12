import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: batchJob } = await supabase
    .from('batch_jobs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!batchJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: batchLinks } = await supabase
    .from('batch_literature')
    .select('literature_id, position')
    .eq('batch_id', id)
    .order('position')

  const literatureIds = batchLinks?.map((l) => l.literature_id) || []

  let literatureItems = []
  if (literatureIds.length > 0) {
    const { data } = await supabase
      .from('literature')
      .select('*')
      .in('id', literatureIds)
    literatureItems = data || []
  }

  return NextResponse.json({ batchJob, literatureItems })
}
