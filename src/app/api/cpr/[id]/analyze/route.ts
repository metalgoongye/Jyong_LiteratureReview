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

// Strip HTML tags to get plain text for matching
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Programmatically inject red sentences into full HTML
// Splits into block segments and searches plain-text of each block — handles inline tags reliably
function buildAnnotatedHtml(originalHtml: string, gaps: LiteratureGap[]): string {
  // Fallback: if no original HTML, list gaps as standalone red sentences
  if (!originalHtml) {
    let fallback = '<div>'
    for (const gap of gaps) {
      if (gap.insertion_text) {
        fallback += `<p style="color:#dc2626;margin-top:0;margin-bottom:0.5em;"><em>[${gap.topic}]</em> ${escapeHtml(gap.insertion_text)}</p>`
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

  // Split HTML into block-level segments (each ends at a closing block tag)
  const blocks: string[] = []
  let remaining = originalHtml
  while (remaining.length > 0) {
    const match = remaining.search(/<\/(?:p|h[1-6]|li|blockquote)>/i)
    if (match === -1) {
      blocks.push(remaining)
      break
    }
    const tagEnd = remaining.indexOf('>', match) + 1
    blocks.push(remaining.slice(0, tagEnd))
    remaining = remaining.slice(tagEnd)
  }

  // Map: blockIndex → list of red sentences to insert after it
  const insertAfter = new Map<number, string[]>()

  for (const gap of gaps) {
    if (!gap.location || !gap.insertion_text) continue
    const searchBase = gap.location.replace(/\s+/g, ' ').trim()

    let foundIdx = -1
    outer: for (const len of [30, 22, 15, 10]) {
      const needle = searchBase.slice(0, len).toLowerCase()
      if (needle.length < 5) continue
      for (let i = 0; i < blocks.length; i++) {
        const blockPlain = stripTags(blocks[i]).toLowerCase()
        if (blockPlain.includes(needle)) {
          foundIdx = i
          break outer
        }
      }
    }

    if (foundIdx === -1) continue

    const redSentence = `<p style="color:#dc2626;margin-top:0;margin-bottom:0.5em;">${escapeHtml(gap.insertion_text)}</p>`
    if (!insertAfter.has(foundIdx)) insertAfter.set(foundIdx, [])
    insertAfter.get(foundIdx)!.push(redSentence)
  }

  // Reconstruct HTML with insertions in place
  let html = blocks.map((block, i) => {
    const inserts = insertAfter.get(i)
    return inserts ? block + inserts.join('') : block
  }).join('')

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
      // synthesis route stores: sections[].content (not body), references as string[]
      const result = synthesis.result as {
        title?: string
        sections?: Array<{ heading: string; content?: string; body?: string }>
        references?: string[] | Array<{ id: string; citation: string }>
      }
      const sectionsText = (result.sections || [])
        .map((s) => `[${s.heading}]\n${s.content || s.body || ''}`)
        .join('\n\n')

      // references may be string[] (synthesis route output) or {id, citation}[] (legacy)
      const rawRefs = result.references || []
      synthesisRefList = rawRefs
        .map((r) => (typeof r === 'string' ? r : (r as { citation: string }).citation))
        .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)

      const refsText = synthesisRefList.map((r, i) => `[${i + 1}] ${r}`).join('\n')

      synthesisContext = `Synthesis Topic: ${synthesis.hypothesis}\n\n${sectionsText}\n\nAvailable References:\n${refsText}`
    }
  }

  // Use plain text for AI (truncated to fit context)
  const manuscriptText = (session.original_text || '').slice(0, 10000)

  // Full original HTML for programmatic annotation (no truncation)
  // If original_html not stored (old sessions), generate from plain text
  let originalHtml = session.original_html || ''
  if (!originalHtml && session.original_text) {
    originalHtml = (session.original_text as string)
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => `<p>${escapeHtml(line.trim())}</p>`)
      .join('\n')
  }

  const systemPrompt = `You are the world's foremost academic authority helping to develop a manuscript into a publication-ready paper.
Your primary goal: find logical argument gaps in the manuscript and fill them with evidence from the synthesis to create a seamlessly integrated, coherent academic argument.
Think of it this way: if the manuscript says "A→B" in one sentence and "A→C" later, but the synthesis shows "B→C", you should insert "B→C" between those sentences so the argument flows A→B→C→A→C naturally.
Write responses in the same language as the manuscript (Korean if Korean, English if English).
Be specific — cite exact paragraph locations and provide sentences that fit naturally into the manuscript's flow.`

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
    ? `literature_gaps: Find 3-5 places in the manuscript where inserting synthesis evidence would bridge a logical gap or strengthen the argument chain — WITHOUT duplicating citations already in the manuscript.
HOW TO FIND GAPS: Look for argument leaps where the manuscript jumps from premise A to conclusion C without establishing the connecting step B. The synthesis evidence provides those B→C links.
CRITICAL RULES:
- insertion_text MUST cite REAL authors from the Available References list above (e.g., "Ewing et al. (2016)"). Never invent authors.
- Copy exact author names and year from the Available References list.
- The inserted sentence must read as a natural continuation of the surrounding text — not as a bracketed annotation.
- new_references MUST be copied verbatim from the Available References list.
For each gap:
- topic: brief label describing what logical link is being added (Korean if manuscript is Korean)
- location: quote the EXACT first 8-10 words of the sentence/paragraph AFTER which to insert (verbatim from manuscript)
- insertion_text: 1-2 academic sentences that bridge the argument gap, citing real authors, written to flow naturally with the surrounding text
- new_references: EXACT full citation string(s) from Available References for each cited author`
    : `literature_gaps: Identify 3-5 argument gaps in the manuscript where a connecting sentence would strengthen the logical flow. For each:
- topic: brief label (Korean if manuscript is Korean)
- location: quote the exact first 8-10 words of the sentence/paragraph after which to insert
- insertion_text: 1-2 academic sentences that bridge the logical gap
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
