import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch session
  const { data: session, error: sessionError } = await supabase
    .from('cpr_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (sessionError || !session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Mark as analyzing
  await supabase.from('cpr_sessions').update({ status: 'analyzing' }).eq('id', id)

  // Fetch synthesis context if linked
  let synthesisContext = ''
  if (session.synthesis_id) {
    const { data: synthesis } = await supabase
      .from('syntheses')
      .select('hypothesis, result')
      .eq('id', session.synthesis_id)
      .single()

    if (synthesis?.result) {
      const result = synthesis.result as {
        title?: string
        sections?: Array<{ heading: string; body: string; references?: string[] }>
        references?: Array<{ id: string; citation: string }>
      }
      const sectionsText = (result.sections || [])
        .map((s) => `[${s.heading}]\n${s.body}`)
        .join('\n\n')
      const refsText = (result.references || [])
        .map((r) => `${r.id}: ${r.citation}`)
        .join('\n')

      synthesisContext = `Hypothesis: ${synthesis.hypothesis}\nTitle: ${result.title || ''}\n\n${sectionsText}\n\nReferences:\n${refsText}`
    }
  }

  // Truncate manuscript if too long (keep first 12000 chars to stay within token limits)
  const manuscriptText = session.original_text?.slice(0, 12000) || ''

  const systemPrompt = `You are the world's foremost academic authority in the field of this manuscript.
You provide rigorous, specific, and constructive peer review. Your feedback is based on methodological
rigor, theoretical grounding, clarity, and contribution to the field. Be specific and cite exact
sections or sentences when possible. Write your review in the same language as the manuscript
(Korean if the manuscript is in Korean, English if in English).`

  const reviewerSection = session.reviewer_comments
    ? `\n=== REVIEWER COMMENTS TO ADDRESS ===\n${session.reviewer_comments}\n`
    : ''

  const synthesisSection = synthesisContext
    ? `\n=== AVAILABLE SYNTHESIS EVIDENCE ===\n${synthesisContext}\n`
    : ''

  const taskB = session.reviewer_comments
    ? 'B. For each reviewer comment listed above, provide a specific response strategy — what to argue, what to add, what to revise.'
    : 'B. (No reviewer comments provided — leave reviewer_responses as empty array)'

  const taskC = synthesisContext
    ? 'C. Suggest 2-3 specific locations in the manuscript where the synthesis evidence above would strengthen the argument. Be precise about where to insert and what to say.'
    : 'C. (No synthesis linked — leave synthesis_suggestions as empty array)'

  const userPrompt = `=== MANUSCRIPT ===
${manuscriptText}
${reviewerSection}${synthesisSection}
TASKS:
A. Expert review: evaluate overall quality, identify strengths (what is done well), major concerns (serious issues that must be fixed), and minor concerns (suggestions for improvement).
${taskB}
${taskC}
D. Return annotated_html: reproduce the full manuscript as HTML. At 3-7 strategic locations, insert an AI annotation as:
   <span style="color:#dc2626;font-weight:500;">[AI 제안: your specific suggestion here]</span>
   Place annotations at the end of the relevant sentence or paragraph. Focus on the most impactful improvement points.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "overall_assessment": "string — 2-4 sentence overall evaluation",
  "strengths": ["string", "..."],
  "major_concerns": ["string", "..."],
  "minor_concerns": ["string", "..."],
  "reviewer_responses": ["string — one per reviewer comment", "..."],
  "synthesis_suggestions": ["string", "..."],
  "annotated_html": "full manuscript HTML string with inline red annotations"
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

    const parsed = JSON.parse(raw) as {
      overall_assessment: string
      strengths: string[]
      major_concerns: string[]
      minor_concerns: string[]
      reviewer_responses: string[]
      synthesis_suggestions: string[]
      annotated_html: string
    }

    const expert_review = {
      overall_assessment: parsed.overall_assessment || '',
      strengths: parsed.strengths || [],
      major_concerns: parsed.major_concerns || [],
      minor_concerns: parsed.minor_concerns || [],
      reviewer_responses: parsed.reviewer_responses || [],
      synthesis_suggestions: parsed.synthesis_suggestions || [],
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
