import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filenames } = await request.json()
  if (!filenames || !Array.isArray(filenames)) {
    return NextResponse.json({ duplicates: [] })
  }

  const { data } = await supabase
    .from('literature')
    .select('id, original_filename, title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .in('original_filename', filenames)

  return NextResponse.json({ duplicates: data || [] })
}
