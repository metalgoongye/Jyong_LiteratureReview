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

=== PART B: RESEARCH QUALITY — rate each dimension (0=very poor, 100=excellent) ===
Evaluate the RESEARCH PAPER ITSELF (not the extraction):
1. Accurate: factual correctness, numbers and claims correctly stated and attributed (100 = no errors)
2. Precise: specificity of claims, units provided, confidence intervals/effect sizes reported (100 = very precise)
3. Consistent: logical coherence — A=B and B=C implies A=C; no internal data contradictions (100 = fully consistent)
4. Coherent: section flow, conclusions well-supported by evidence, organized argument (100 = very coherent)
5. Overall: holistic research design quality — your overall judgment of the paper's completeness and rigor (100 = excellent)

For any score below 80, give a brief specific reason (1-2 sentences). For scores 80+ use empty string.

Return ONLY valid JSON (no markdown):
{
  "accuracy": {
    "abstract_alignment": <number|null>,
    "field_completeness": <number>,
    "overall": <number>
  },
  "six_is": {
    "accurate": <number>,
    "accurate_reason": "<string>",
    "precise": <number>,
    "precise_reason": "<string>",
    "consistent": <number>,
    "consistent_reason": "<string>",
    "coherent": <number>,
    "coherent_reason": "<string>",
    "overall": <number>,
    "overall_reason": "<string>"
  }
}`

  try {
    const rawResponse = await callOpenRouter({
      model: 'anthropic/claude-sonnet-4-6',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 2000,
    })

    let parsed: {
      accuracy: { abstract_alignment: number | null; field_completeness: number; overall: number }
      six_is: {
        accurate: number; accurate_reason: string
        precise: number; precise_reason: string
        consistent: number; consistent_reason: string
        coherent: number; coherent_reason: string
        overall: number; overall_reason: string
      }
    }
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      // Fallback: extract JSON from markdown code blocks
      const match = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (match) {
        try {
          parsed = JSON.parse(match[1])
        } catch {
          throw new Error('AI 응답 파싱 실패')
        }
      } else {
        throw new Error('AI 응답 파싱 실패')
      }
    }

    const { accuracy, six_is } = parsed

    // Derive average from 4 base indicators (higher = better)
    const baseTotal = six_is.accurate + six_is.precise + six_is.consistent + six_is.coherent
    const average = baseTotal / 4
    const grade =
      baseTotal >= 320 ? 'A' : baseTotal >= 240 ? 'B' : baseTotal >= 160 ? 'C' : 'D'

    const verifiedAt = new Date().toISOString()

    const six_is_scores = {
      accurate: six_is.accurate,
      accurate_reason: six_is.accurate_reason,
      precise: six_is.precise,
      precise_reason: six_is.precise_reason,
      consistent: six_is.consistent,
      consistent_reason: six_is.consistent_reason,
      coherent: six_is.coherent,
      coherent_reason: six_is.coherent_reason,
      average,
      overall: six_is.overall,
      overall_reason: six_is.overall_reason,
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
