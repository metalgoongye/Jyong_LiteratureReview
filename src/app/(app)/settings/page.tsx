import { createClient } from '@/lib/supabase/server'
import { PromptEditor } from '@/components/settings/PromptEditor'
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from '@/lib/openrouter/prompts'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: prompts } = await supabase
    .from('ai_prompts')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at')

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">설정</h1>
        <p className="text-sm opacity-50 mt-0.5">AI 프롬프트 및 분석 설정</p>
      </div>

      <div className="glass-card p-6 mb-6">
        <h2 className="font-medium mb-1">계정 정보</h2>
        <p className="text-sm opacity-50">{user?.email}</p>
      </div>

      <PromptEditor
        userId={user!.id}
        existingPrompts={prompts || []}
        defaultSystemPrompt={DEFAULT_SYSTEM_PROMPT}
        defaultUserPromptTemplate={DEFAULT_USER_PROMPT_TEMPLATE}
      />
    </div>
  )
}
