import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callOpenRouter } from '@/lib/openrouter/client'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch literature + content + evidence
  const { data: lit, error: litErr } = await supabase
    .from('literature')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (litErr || !lit) return NextResponse.json({ error: '문헌을 찾을 수 없습니다' }, { status: 404 })

  const { data: content } = await supabase
    .from('literature_content')
    .select('section_type, bullets_original')
    .eq('literature_id', id)

  const { data: evidence } = await supabase
    .from('empirical_evidence')
    .select('evidence_text, metric_name, metric_value, metric_unit')
    .eq('literature_id', id)

  // Build context string
  const abstractSection = lit.abstract
    ? `ORIGINAL ABSTRACT:\n${lit.abstract}`
    : '[No abstract available]'

  const extractedMeta = [
    `Title: ${lit.title || '(none)'}`,
    `Authors: ${(lit.authors || []).join(', ') || '(none)'}`,
    `Year: ${lit.year || '(none)'}`,
    `Journal: ${lit.journal_name || '(none)'}`,
    `Fields: ${(lit.fields || []).join(', ') || '(none)'}`,
  ].join('\n')

  const contentLines = (content || [])
    .flatMap((c) =>
      (c.bullets_original || []).map(
        (b: { text: string }) => `  [${c.section_type}] ${b.text}`
      )
    )
    .join('\n')

  const evidenceLines = (evidence || [])
    .map((e) => {
      const metric =
        e.metric_name && e.metric_value
          ? ` (${e.metric_name}: ${e.metric_value}${e.metric_unit ? ' ' + e.metric_unit : ''})`
          : ''
      return `  - ${e.evidence_text}${metric}`
    })
    .join('\n')

  const prompt = `You are auditing an academic paper's extraction quality and research quality.

=== PART A: EXTRACTION ACCURACY ===
${abstractSection}

EXTRACTED METADATA:
${extractedMeta}

EXTRACTED CONTENT:
${contentLines || '(none)'}

EMPIRICAL EVIDENCE:
${evidenceLines || '(none)'}

Rate extraction quality:
- abstract_alignment: how well the extracted content matches the abstract (0-100, or null if no abstract)
- field_completeness: how complete are the extracted fields overall (0-100)
- overall: overall extraction quality (0-100)

=== PART B: SIX Is — rate each DEFECT (0=none, 100=severe) ===
Evaluate the RESEARCH PAPER ITSELF (not the extraction):
1. Inaccurate: factual errors, wrong numbers, misattributed claims in the paper
2. Imprecise: vague claims, missing units, no confidence intervals, fuzzy measurements
3. Inconsistent: logical contradictions — if A=B and B=C then A=C must hold; internal data contradictions
4. Incoherent: poor section flow, conclusions unsupported by evidence presented, disorganized argument
5. Imperfect: holistic research design quality — your overall judgment of the paper's completeness and rigor

For any non-zero score, give a brief specific reason (1-2 sentences). For zero scores use empty string.

Return ONLY valid JSON (no markdown):
{
  "accuracy": {
    "abstract_alignment": <number|null>,
    "field_completeness": <number>,
    "overall": <number>
  },
  "six_is": {
    "inaccurate": <number>,
    "inaccurate_reason": "<string>",
    "imprecise": <number>,
    "imprecise_reason": "<string>",
    "inconsistent": <number>,
    "inconsistent_reason": "<string>",
    "incoherent": <number>,
    "incoherent_reason": "<string>",
    "imperfect": <number>,
    "imperfect_reason": "<string>"
  }
}`

  try {
    const rawResponse = await callOpenRouter({
      model: 'anthropic/claude-opus-4-6',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000,
    })

    let parsed: {
      accuracy: { abstract_alignment: number | null; field_completeness: number; overall: number }
      six_is: {
        inaccurate: number; inaccurate_reason: string
        imprecise: number; imprecise_reason: string
        inconsistent: number; inconsistent_reason: string
        incoherent: number; incoherent_reason: string
        imperfect: number; imperfect_reason: string
      }
    }
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      throw new Error('AI 응답 파싱 실패')
    }

    const { accuracy, six_is } = parsed

    // Derive incomplete and grade from 4 base indicators
    const baseTotal = six_is.inaccurate + six_is.imprecise + six_is.inconsistent + six_is.incoherent
    const incomplete = baseTotal / 4
    const grade =
      baseTotal <= 80 ? 'A' : baseTotal <= 160 ? 'B' : baseTotal <= 240 ? 'C' : 'D'

    const verifiedAt = new Date().toISOString()

    const six_is_scores = {
      inaccurate: six_is.inaccurate,
      inaccurate_reason: six_is.inaccurate_reason,
      imprecise: six_is.imprecise,
      imprecise_reason: six_is.imprecise_reason,
      inconsistent: six_is.inconsistent,
      inconsistent_reason: six_is.inconsistent_reason,
      incoherent: six_is.incoherent,
      incoherent_reason: six_is.incoherent_reason,
      incomplete,
      imperfect: six_is.imperfect,
      imperfect_reason: six_is.imperfect_reason,
      base_total: baseTotal,
      grade,
      verified_at: verifiedAt,
    }

    const accuracy_details = {
      abstract_alignment: accuracy.abstract_alignment ?? null,
      field_completeness: accuracy.field_completeness,
      overall: accuracy.overall,
      verified_at: verifiedAt,
    }

    // Update literature record
    await supabase
      .from('literature')
      .update({
        extraction_accuracy: accuracy.overall,
        accuracy_details,
        six_is_scores,
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ six_is_scores, accuracy_details })
  } catch (error) {
    const msg = error instanceof Error ? error.message : '검증 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
