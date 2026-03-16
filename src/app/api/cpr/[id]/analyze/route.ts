import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'

export const maxDuration = 120

interface LiteratureGap {
  topic: string
  location: string
  insertion_text: string
  new_references: string[]
}

interface AnalysisResult {
  gaps_summary: string
  literature_gaps: LiteratureGap[]
  overall_assessment: string
  strengths: string[]
  major_concerns: string[]
  reviewer_responses: string[]
  annotated_html: string
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session, error: sessionError } = await supabase
    .from('cpr_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase.from('cpr_sessions').update({ status: 'analyzing' }).eq('id', id)

  // Build synthesis context (list of evidence with citations)
  let synthesisContext = ''
  let synthesisRefList: string[] = []
  if (session.synthesis_id) {
    const { data: synthesis } = await supabase
      .from('syntheses')
      .select('hypothesis, result')
      .eq('id', session.synthesis_id)
      .single()

    if (synthesis?.result) {
      const result = synthesis.result as {
        title?: string
        sections?: Array<{ heading: string; body: string }>
        references?: Array<{ id: string; citation: string }>
      }
      const sectionsText = (result.sections || [])
        .map((s) => `[${s.heading}]\n${s.body}`)
        .join('\n\n')

      synthesisRefList = (result.references || []).map((r) => r.citation)
      const refsText = synthesisRefList.map((r, i) => `[${i + 1}] ${r}`).join('\n')

      synthesisContext = `Synthesis Topic: ${synthesis.hypothesis}\n\n${sectionsText}\n\nAvailable References:\n${refsText}`
    }
  }

  // original_html is preserved in its own column — safe for re-analysis
  const originalHtml = session.original_html || ''

  // Use plain text for AI (truncated to fit context)
  const manuscriptText = (session.original_text || '').slice(0, 10000)

  const systemPrompt = `You are the world's foremost academic authority reviewing a manuscript.
Your primary goal: identify gaps in prior literature coverage and suggest specific evidence from the synthesis to fill those gaps.
Write responses in the same language as the manuscript (Korean if Korean, English if English).
Be specific — cite exact locations in the manuscript and provide ready-to-insert academic sentences.`

  const reviewerSection = session.reviewer_comments
    ? `\n=== REVIEWER COMMENTS ===\n${session.reviewer_comments.slice(0, 3000)}\n`
    : ''

  const synthesisSection = synthesisContext
    ? `\n=== SYNTHESIS EVIDENCE (use these to fill literature gaps) ===\n${synthesisContext.slice(0, 6000)}\n`
    : ''

  const taskReviewer = session.reviewer_comments
    ? 'reviewer_responses: For each reviewer comment, one specific response strategy (same order as comments above). If no comments, return [].'
    : ''

  const taskSynthesis = synthesisContext
    ? `literature_gaps: Find 3-5 places in the manuscript where evidence from the synthesis above would strengthen the argument WITHOUT duplicating existing citations.
For each gap:
- topic: brief topic label
- location: quote the first 8-10 words of the sentence/paragraph BEFORE the insertion point
- insertion_text: a complete academic sentence (or 2) citing the synthesis source, ready to copy-paste. Must be NEW content not already in the manuscript.
- new_references: array of full APA/Chicago reference strings for sources cited in insertion_text (from the Available References list above)`
    : `literature_gaps: Identify 3-5 prior literature gaps in the manuscript. For each:
- topic: brief topic label
- location: quote the first 8-10 words of the sentence/paragraph before insertion point
- insertion_text: suggested academic sentence to add (general recommendation, no specific source)
- new_references: []`

  const htmlInstruction = originalHtml
    ? `annotated_html: Take the following ORIGINAL HTML and insert red-highlighted additions at the correct locations.
For each literature gap insertion, find the paragraph matching the location hint and append:
<span style="color:#dc2626;font-style:italic;"> [문헌 보강 제안: INSERT_TEXT (Author, Year)]</span>
At the very end of the document, add:
<p style="margin-top:24px;"><strong>추가 참고문헌 제안</strong></p>
Then list each new reference as: <p style="color:#dc2626;margin-top:4px;">▸ REFERENCE_TEXT</p>

ORIGINAL HTML TO ANNOTATE:
${originalHtml.slice(0, 8000)}`
    : `annotated_html: Return the manuscript text as HTML with red insertions.`

  const userPrompt = `=== MANUSCRIPT ===
${manuscriptText}
${reviewerSection}${synthesisSection}

TASKS:
1. overall_assessment: 2-3 sentence expert evaluation of the manuscript quality
2. strengths: 2-4 specific strengths (array of strings)
3. major_concerns: 2-4 serious issues beyond literature gaps (array of strings)
4. ${taskReviewer ? taskReviewer + '\n5.' : '5.'} gaps_summary: 1-2 sentences summarizing what prior literature the manuscript is missing
5. ${taskSynthesis}
6. ${htmlInstruction}

Return ONLY valid JSON (no markdown fences):
{
  "overall_assessment": "string",
  "strengths": ["..."],
  "major_concerns": ["..."],
  "reviewer_responses": ["..."],
  "gaps_summary": "string",
  "literature_gaps": [
    {
      "topic": "string",
      "location": "string — first 8-10 words of the paragraph before insertion",
      "insertion_text": "string — ready-to-insert academic sentence(s)",
      "new_references": ["string — full reference entry"]
    }
  ],
  "annotated_html": "string — full HTML with red insertions and new references at bottom"
}`

  try {
    const raw = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 16000,
    })

    const parsed = JSON.parse(raw) as AnalysisResult

    const expert_review = {
      overall_assessment: parsed.overall_assessment || '',
      strengths: parsed.strengths || [],
      major_concerns: parsed.major_concerns || [],
      reviewer_responses: parsed.reviewer_responses || [],
      gaps_summary: parsed.gaps_summary || '',
      literature_gaps: parsed.literature_gaps || [],
    }

    await supabase.from('cpr_sessions').update({
      expert_review,
      annotated_html: parsed.annotated_html || '',
      status: 'completed',
    }).eq('id', id)

    return NextResponse.json({ expert_review, annotated_html: parsed.annotated_html || '' })
  } catch (err) {
    await supabase.from('cpr_sessions').update({ status: 'failed' }).eq('id', id)
    const msg = err instanceof Error ? err.message : '분석 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
