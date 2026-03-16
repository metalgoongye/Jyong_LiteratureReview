import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { review } = await req.json()
  if (!review) return NextResponse.json({ error: 'Review data required' }, { status: 400 })

  const { data: synthesis, error: synthError } = await supabase
    .from('syntheses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (synthError || !synthesis) return NextResponse.json({ error: 'Synthesis not found' }, { status: 404 })

  const { data: literature } = await supabase
    .from('literature')
    .select('id, title, authors, year, journal_name, volume, issue, pages, doi, abstract')
    .eq('user_id', user.id)
    .eq('extraction_status', 'completed')

  const litIds = (literature || []).map((l) => l.id)

  const { data: evidence } = await supabase
    .from('empirical_evidence')
    .select('literature_id, evidence_text, metric_name, metric_value, metric_unit, page_reference')
    .in('literature_id', litIds.length > 0 ? litIds : ['none'])

  const { data: content } = await supabase
    .from('literature_content')
    .select('literature_id, section_type, bullets_original')
    .in('literature_id', litIds.length > 0 ? litIds : ['none'])

  const litContext = (literature || []).map((lit, idx) => {
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
      const metric = e.metric_name && e.metric_value ? ` (${e.metric_name}: ${e.metric_value}${e.metric_unit ? ' ' + e.metric_unit : ''})` : ''
      return `  - ${page} ${e.evidence_text}${metric}`
    }).join('\n')

    const contentLines = litContent
      .flatMap((c) => (c.bullets_original || []).slice(0, 2).map((b: { text: string }) => `  • [${c.section_type}] ${b.text}`))
      .join('\n')

    const abstract = lit.abstract ? `  Abstract: ${lit.abstract.slice(0, 300)}...` : ''

    return `[REF${idx + 1}] ${citation}. ${lit.title}. ${journalInfo}.${lit.doi ? ` DOI: ${lit.doi}` : ''}\n${abstract}\n${evidenceLines}\n${contentLines}`
  }).join('\n\n')

  const proposalText = synthesis.result?.sections
    ?.map((s: { heading: string; content: string }) => `## ${s.heading}\n${s.content}`)
    .join('\n\n') || ''

  // Format review issues for the prompt
  const citationIssues = (review.citation_issues || [])
    .map((issue: { claim: string; issue: string; severity: string }) =>
      `  [${issue.severity.toUpperCase()}] Claim: "${issue.claim}" → Problem: ${issue.issue}`)
    .join('\n')

  const evidenceGaps = (review.evidence_gaps || []).map((g: string) => `  - ${g}`).join('\n')
  const unsupportedClaims = (review.unsupported_claims || []).map((c: string) => `  - ${c}`).join('\n')

  const systemPrompt = `You are an expert academic research synthesis assistant. You revise and improve research proposals based on specific reviewer feedback. Write in clear academic English. Be precise with citations.`

  const userPrompt = `HYPOTHESIS: "${synthesis.hypothesis}"

=== ORIGINAL PROPOSAL (needs improvement) ===
Title: ${synthesis.result?.title || ''}

${proposalText}

References:
${(synthesis.result?.references || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

=== PEER REVIEW FINDINGS (issues to fix) ===
Overall reliability was: ${review.overall_reliability}/100

CITATION ISSUES TO FIX:
${citationIssues || '  (none)'}

EVIDENCE GAPS TO FILL:
${evidenceGaps || '  (none)'}

UNSUPPORTED CLAIMS TO REMOVE OR QUALIFY:
${unsupportedClaims || '  (none)'}

=== FULL LITERATURE LIBRARY (use this to fix the issues) ===
${litContext}

=== YOUR TASK ===
Produce an improved version of the research proposal that:
1. Fixes every citation issue listed above — correct the claims or remove them if unsupported
2. Incorporates the missing evidence from the evidence gaps list
3. Qualifies or removes every unsupported claim
4. Maintains the same structural flow and academic quality
5. Uses inline APA citations referencing REF numbers (e.g., "Smith & Jones, 2019, p. 5")

Return ONLY valid JSON with the same structure:
{
  "title": "Short descriptive proposal title",
  "hypothesis": "Refined 1-2 sentence hypothesis statement",
  "sections": [
    {
      "heading": "Section heading",
      "content": "Improved paragraph text with inline citations."
    }
  ],
  "references": [
    "Full APA 7th edition reference string"
  ]
}`

  try {
    const rawResponse = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 8000,
    })

    let improved
    try {
      improved = JSON.parse(rawResponse)
    } catch {
      throw new Error('AI 개선 응답 파싱 실패')
    }

    // Update synthesis in DB, clear review since it's now outdated
    await supabase
      .from('syntheses')
      .update({ result: improved, review: null })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ result: improved })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Improve failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
