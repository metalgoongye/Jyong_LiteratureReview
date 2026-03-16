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
}

function escapeHtml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Programmatically inject red spans into full HTML — no truncation, no AI hallucination
function buildAnnotatedHtml(originalHtml: string, gaps: LiteratureGap[]): string {
  // Fallback: if no original HTML, build a simple document from gaps alone
  if (!originalHtml) {
    let fallback = '<div>'
    for (const gap of gaps) {
      if (gap.insertion_text) {
        fallback += `<p style="color:#dc2626;font-style:italic;margin-top:8px;">[보강 제안 — ${gap.topic}] ${escapeHtml(gap.insertion_text)}</p>`
      }
    }
    const allRefs = gaps.flatMap((g) => g.new_references || []).filter(Boolean)
    const dedupedRefs = [...new Set(allRefs)]
    if (dedupedRefs.length > 0) {
      fallback += `<p style="margin-top:24px;font-weight:bold;">추가 참고문헌 제안</p>`
      for (const ref of dedupedRefs) {
        fallback += `<p style="color:#dc2626;margin-top:4px;">▸ ${escapeHtml(ref)}</p>`
      }
    }
    fallback += '</div>'
    return fallback
  }

  let html = originalHtml

  for (const gap of gaps) {
    if (!gap.location || !gap.insertion_text) continue

    // Try progressively shorter substrings if exact match fails
    const fullSearch = gap.location.replace(/\s+/g, ' ').trim()
    const candidates = [
      fullSearch.slice(0, 30),
      fullSearch.slice(0, 20),
      fullSearch.slice(0, 12),
    ]

    let insertPos = -1
    for (const searchStr of candidates) {
      if (!searchStr) continue
      const idx = html.toLowerCase().indexOf(searchStr.toLowerCase())
      if (idx !== -1) {
        const paraEnd = html.indexOf('</p>', idx)
        if (paraEnd !== -1) {
          insertPos = paraEnd + 4
          break
        }
      }
    }

    if (insertPos === -1) continue

    const redSpan = `<p style="color:#dc2626;font-style:italic;margin-top:4px;">[보강 제안: ${escapeHtml(gap.insertion_text)}]</p>`
    html = html.slice(0, insertPos) + redSpan + html.slice(insertPos)
  }

  // Append new references section (deduplicated)
  const allNewRefs = gaps.flatMap((g) => g.new_references || []).filter(Boolean)
  const dedupedRefs = [...new Set(allNewRefs)]

  if (dedupedRefs.length > 0) {
    html += `\n<p style="margin-top:24px;font-weight:bold;">추가 참고문헌 제안</p>\n`
    for (const ref of dedupedRefs) {
      html += `<p style="color:#dc2626;margin-top:4px;">▸ ${escapeHtml(ref)}</p>\n`
    }
  }

  return html
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

      // filter(Boolean) removes undefined/null/empty strings
      synthesisRefList = (result.references || [])
        .map((r) => r.citation)
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)

      const refsText = synthesisRefList.map((r, i) => `[${i + 1}] ${r}`).join('\n')

      synthesisContext = `Synthesis Topic: ${synthesis.hypothesis}\n\n${sectionsText}\n\nAvailable References:\n${refsText}`
    }
  }

  // Use plain text for AI (truncated to fit context)
  const manuscriptText = (session.original_text || '').slice(0, 10000)

  // Full original HTML stored separately — used for programmatic annotation (no truncation)
  const originalHtml = session.original_html || ''

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
    ? 'reviewer_responses: 각 리뷰어 코멘트에 대해 구체적인 대응 전략을 한국어로 작성하세요 (코멘트 순서와 동일). 코멘트 없으면 [].'
    : ''

  const taskSynthesis = synthesisContext
    ? `literature_gaps: Find 3-5 specific places in the manuscript where the synthesis references above would strengthen the argument WITHOUT duplicating citations already in the manuscript.
CRITICAL RULES:
- insertion_text MUST cite REAL authors from the Available References list above (e.g., "Ewing et al. (2016)" or "Glaeser & Kahn (2008)"). Never invent authors.
- Copy the exact author names and year from the Available References list.
- Draw the substance of insertion_text from the synthesis sections above (which summarize what those papers found).
- new_references MUST be copied verbatim from the Available References list — do not paraphrase or shorten.
For each gap:
- topic: brief topic label (Korean if manuscript is Korean)
- location: quote the first 8-10 words of the sentence/paragraph BEFORE the insertion point
- insertion_text: 1-2 complete academic sentences using real authors from the reference list, ready to paste into the manuscript
- new_references: copy the EXACT full citation string(s) from the Available References list for each author cited`
    : `literature_gaps: Identify 3-5 prior literature gaps in the manuscript. For each:
- topic: brief topic label
- location: quote the first 8-10 words of the sentence/paragraph before insertion point
- insertion_text: suggested academic sentence to add (general recommendation, no specific source)
- new_references: []`

  const userPrompt = `=== MANUSCRIPT ===
${manuscriptText}
${reviewerSection}${synthesisSection}

TASKS:
1. overall_assessment: 2-3 sentence expert evaluation of the manuscript quality
2. strengths: 2-4 specific strengths (array of strings)
3. major_concerns: 2-4 serious issues beyond literature gaps (array of strings)
4. ${taskReviewer ? taskReviewer + '\n5.' : '5.'} gaps_summary: 1-2 sentences summarizing what prior literature the manuscript is missing
5. ${taskSynthesis}

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
  ]
}`

  try {
    const raw = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 8000,
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

    // Programmatically annotate the FULL original HTML — no truncation
    // buildAnnotatedHtml handles empty originalHtml via fallback
    const annotated_html = buildAnnotatedHtml(originalHtml, expert_review.literature_gaps)

    await supabase.from('cpr_sessions').update({
      expert_review,
      annotated_html,
      status: 'completed',
    }).eq('id', id)

    return NextResponse.json({ expert_review, annotated_html })
  } catch (err) {
    await supabase.from('cpr_sessions').update({ status: 'failed' }).eq('id', id)
    const msg = err instanceof Error ? err.message : '분석 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
