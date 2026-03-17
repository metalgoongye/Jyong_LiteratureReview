import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGemini } from '@/lib/gemini/client'

export const maxDuration = 60

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: synthesis, error } = await supabase
    .from('syntheses')
    .select('hypothesis, title, result, research_design')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !synthesis) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Return cached result if already generated
  if (synthesis.research_design) {
    return NextResponse.json({ research_design: synthesis.research_design })
  }

  const result = synthesis.result as {
    sections?: Array<{ heading: string; content?: string }>
  } | null

  const sectionsText = (result?.sections || [])
    .map((s) => `[${s.heading}]\n${s.content || ''}`)
    .join('\n\n')

  const systemPrompt = `You are an expert research methodologist. Based on a synthesis of academic literature, generate a concrete research design plan. Always respond in Korean. Be specific and practical — name exact methods, software, and data sources.`

  const userPrompt = `가설: "${synthesis.hypothesis}"

합성 내용:
${sectionsText.slice(0, 4000)}

위 가설을 검증하기 위한 연구설계를 생성하라. Return ONLY valid JSON:
{
  "causal_paths": [
    {
      "from": "독립변수명 (영문 약어 포함)",
      "to": "종속/매개변수명 (영문 약어 포함)",
      "mechanism": "이 경로의 작동 메커니즘 1-2문장",
      "path_type": "direct" | "mediated" | "moderated"
    }
  ],
  "key_variables": {
    "independent": ["변수명 (측정지표 예시 포함)"],
    "mediator": ["변수명 (측정지표 포함)"],
    "dependent": ["변수명 (측정지표 포함)"],
    "moderator": ["조절변수명 (있는 경우만)"],
    "control": ["통제변수명"]
  },
  "analysis_methods": [
    {
      "method": "분석방법명 (영문명 포함)",
      "purpose": "이 방법으로 무엇을 검증하는지",
      "software": "R (lavaan) / SPSS / Stata / Python (statsmodels) 등"
    }
  ],
  "data_requirements": [
    {
      "variable": "변수명",
      "source": "구체적 데이터 출처 (예: World Bank WDI, OECD.Stat, 통계청)",
      "unit": "측정 단위",
      "level": "개인/가구/도시/국가 등 분석 단위"
    }
  ],
  "summary": "이 연구설계로 가설을 어떻게 검증하는지 2-3문장 요약"
}`

  try {
    const raw = await callGemini({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4000,
    })

    const research_design = JSON.parse(raw)

    await supabase.from('syntheses').update({ research_design }).eq('id', id)

    return NextResponse.json({ research_design })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '연구설계 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
