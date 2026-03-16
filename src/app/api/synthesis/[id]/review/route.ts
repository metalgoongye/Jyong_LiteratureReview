import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch the synthesis
  const { data: synthesis, error: synthError } = await supabase
    .from('syntheses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (synthError || !synthesis) return NextResponse.json({ error: 'Synthesis not found' }, { status: 404 })

  // Fetch all completed literature for context
  const { data: literature } = await supabase
    .from('literature')
    .select('id, title, authors, year, abstract')
    .eq('user_id', user.id)
    .eq('extraction_status', 'completed')

  const litIds = (literature || []).map((l) => l.id)

  const { data: evidence } = await supabase
    .from('empirical_evidence')
    .select('literature_id, evidence_text, metric_name, metric_value, metric_unit')
    .in('literature_id', litIds.length > 0 ? litIds : ['none'])

  const { data: content } = await supabase
    .from('literature_content')
    .select('literature_id, section_type, bullets_original')
    .in('literature_id', litIds.length > 0 ? litIds : ['none'])

  const litContext = (literature || []).map((lit, idx) => {
    const authors = Array.isArray(lit.authors) ? lit.authors.join(', ') : (lit.authors || 'Unknown')
    const litEvidence = (evidence || []).filter((e) => e.literature_id === lit.id)
    const litContent = (content || []).filter((c) => c.literature_id === lit.id)

    const evidenceLines = litEvidence.map((e) => {
      const metric = e.metric_name && e.metric_value ? ` (${e.metric_name}: ${e.metric_value}${e.metric_unit ? ' ' + e.metric_unit : ''})` : ''
      return `  - ${e.evidence_text}${metric}`
    }).join('\n')

    const contentLines = litContent
      .flatMap((c) => (c.bullets_original || []).slice(0, 2).map((b: { text: string }) => `  • [${c.section_type}] ${b.text}`))
      .join('\n')

    const abstract = lit.abstract ? `  Abstract: ${lit.abstract.slice(0, 300)}...` : ''

    return `[REF${idx + 1}] ${authors} (${lit.year || 'n.d.'}). ${lit.title}\n${abstract}\n${evidenceLines}\n${contentLines}`
  }).join('\n\n')

  const proposalText = synthesis.result?.sections
    ?.map((s: { heading: string; content: string }) => `## ${s.heading}\n${s.content}`)
    .join('\n\n') || ''

  const systemPrompt = `You are a rigorous academic peer reviewer. Your task is to critically verify whether a generated research proposal accurately reflects and correctly cites the source literature it claims to draw from. Be specific, concrete, and honest. Do not be lenient.`

  const userPrompt = `ORIGINAL HYPOTHESIS: "${synthesis.hypothesis}"

=== GENERATED RESEARCH PROPOSAL ===
Title: ${synthesis.result?.title || ''}

${proposalText}

References used:
${(synthesis.result?.references || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}

=== ACTUAL SOURCE LITERATURE LIBRARY ===
${litContext}

=== YOUR TASK ===
Critically review the generated proposal against the actual source literature. Check:

1. CITATION ACCURACY: Does each major empirical claim actually appear in the cited source? Flag any claims that misrepresent, exaggerate, or cannot be traced to the stated source.
2. EVIDENCE GAPS: What relevant evidence from the source library was NOT used but should have been?
3. UNSUPPORTED CLAIMS: Identify any claims in the proposal that go beyond what the evidence supports (logical overreach).
4. STRENGTHS: What did the proposal do well in synthesizing the evidence?
5. OVERALL RELIABILITY: Score 0-100 (100 = every claim perfectly traceable and accurate).

Return ONLY valid JSON:
{
  "overall_reliability": number,
  "verdict": "1-2 sentence overall assessment",
  "citation_issues": [
    { "claim": "exact quote or paraphrase from proposal", "issue": "specific problem", "severity": "high" | "medium" | "low" }
  ],
  "evidence_gaps": ["specific evidence from library that was missed"],
  "unsupported_claims": ["claims that go beyond the evidence"],
  "strengths": ["what was done well"]
}`

  try {
    const rawResponse = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
    })

    let review
    try {
      review = JSON.parse(rawResponse)
    } catch {
      throw new Error('AI 검증 응답 파싱 실패')
    }

    // Save review to DB
    await supabase
      .from('syntheses')
      .update({ review })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ review })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Review failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
