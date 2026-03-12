import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    title,
    authors,
    year,
    journal_name,
    volume,
    issue,
    pages,
    publisher,
    country,
    doi,
    abstract,
    language,
    fields,
    user_notes,
    source_url,
    run_ai,
    storage_path,
    original_filename,
  } = body

  const { data: lit, error } = await supabase
    .from('literature')
    .insert({
      user_id: user.id,
      source_type: storage_path ? 'pdf' : source_url ? 'url' : 'pdf',
      source_url: source_url || null,
      storage_path: storage_path || null,
      original_filename: original_filename || null,
      title: title || null,
      authors: authors?.length ? authors : null,
      year: year || null,
      journal_name: journal_name || null,
      volume: volume || null,
      issue: issue || null,
      pages: pages || null,
      publisher: publisher || null,
      country: country || null,
      doi: doi || null,
      abstract: abstract || null,
      language: language || 'english',
      fields: fields?.length ? fields : null,
      user_notes: user_notes || null,
      extraction_status: run_ai ? 'pending' : 'completed',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Trigger AI extraction if requested and there's a PDF
  if (run_ai && lit) {
    // Fire-and-forget extraction
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ literatureId: lit.id }),
    }).catch(() => {})
  }

  return NextResponse.json({ literatureId: lit.id })
}
