import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter/client'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { hypothesis } = await request.json()
  if (!hypothesis) return NextResponse.json({ error: 'Hypothesis is required' }, { status: 400 })

  // Fetch all completed literature
  const { data: literature } = await supabase
    .from('literature')
    .select('id, title, authors, year, journal_name, volume, issue, pages, doi')
    .eq('user_id', user.id)
    .eq('extraction_status', 'completed')

  if (!literature || literature.length === 0) {
    return NextResponse.json({ error: '분석된 문헌이 없습니다. 먼저 문헌을 업로드하고 분석하세요.' }, { status: 400 })
  }

  const litIds = literature.map((l) => l.id)

  // Fetch empirical evidence
  const { data: evidence } = await supabase
    .from('empirical_evidence')
    .select('literature_id, evidence_text, metric_name, metric_value, metric_unit, page_reference')
    .in('literature_id', litIds)

  // Fetch content sections
  const { data: content } = await supabase
    .from('literature_content')
    .select('literature_id, section_type, bullets_original')
    .in('literature_id', litIds)

  // Format literature context
  const litContext = literature.map((lit, idx) => {
    const authors = Array.isArray(lit.authors) ? lit.authors.join(', ') : (lit.authors || 'Unknown Author')
    const citation = `${authors} (${lit.year || 'n.d.'})`
    const journalInfo = [
      lit.journal_name,
      lit.volume ? `Vol. ${lit.volume}` : null,
      lit.issue ? `No. ${lit.issue}` : null,
      lit.pages ? `pp. ${lit.pages}` : null,
    ].filter(Boolean).join(', ')

    const litEvidence = (evidence || []).filter((e) => e.literature_id === lit.id)
    const litContent = (content || []).filter((c) => c.literature_id === lit.id)

    const evidenceLines = litEvidence.map((e) => {
      const page = e.page_reference ? `[p.${e.page_reference}]` : ''
      const metric = e.metric_name && e.metric_value
        ? ` (${e.metric_name}: ${e.metric_value}${e.metric_unit ? ' ' + e.metric_unit : ''})`
        : ''
      return `  - ${page} ${e.evidence_text}${metric}`
    }).join('\n')

    const contentLines = litContent
      .flatMap((c) => (c.bullets_original || []).slice(0, 2).map((b: { text: string }) => `  • [${c.section_type}] ${b.text}`))
      .join('\n')

    return `[REF${idx + 1}] ${citation}. ${lit.title}. ${journalInfo}.${lit.doi ? ` DOI: ${lit.doi}` : ''}\n${evidenceLines}\n${contentLines}`
  }).join('\n\n')

  const systemPrompt = `You are an expert research synthesis assistant. You synthesize evidence from academic literature to support or analyze a given hypothesis. Write in clear academic English. Be precise with citations.`

  const userPrompt = `HYPOTHESIS: "${hypothesis}"

AVAILABLE LITERATURE LIBRARY:
${litContext}

Generate a structured academic research proposal that:
1. Frames and contextualizes the hypothesis
2. Synthesizes evidence from the literature above that supports (or nuances) the hypothesis
3. Uses inline APA citations referencing the REF numbers above (e.g., "Smith & Jones, 2019, p. 5")
4. Draws logical causal connections between studies
5. Ends with a concise conclusion and limitations

Return ONLY valid JSON:
{
  "title": "Short descriptive proposal title",
  "hypothesis": "Refined 1-2 sentence hypothesis statement",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Paragraph text with inline citations (Author, Year, p. X)."
    }
  ],
  "references": [
    "Full APA 7th edition reference string"
  ]
}`

  try {
    const rawResponse = await callOpenRouter({
      model: 'anthropic/claude-sonnet-4-6',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 8000,
    })

    let result
    try {
      result = JSON.parse(rawResponse)
    } catch {
      throw new Error('AI 응답 파싱 실패')
    }

    // Save to DB
    await supabase.from('syntheses').insert({
      user_id: user.id,
      hypothesis,
      title: result.title,
      result,
    })

    return NextResponse.json({ result })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Synthesis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('syntheses')
    .select('id, hypothesis, title, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ syntheses: data })
}
