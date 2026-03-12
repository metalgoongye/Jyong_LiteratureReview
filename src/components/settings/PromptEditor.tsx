'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GlassButton } from '@/components/ui/GlassButton'
import type { AiPrompt } from '@/types/literature'

interface PromptEditorProps {
  userId: string
  existingPrompts: AiPrompt[]
  defaultSystemPrompt: string
  defaultUserPromptTemplate: string
}

export function PromptEditor({
  userId,
  existingPrompts,
  defaultSystemPrompt,
  defaultUserPromptTemplate,
}: PromptEditorProps) {
  const [prompts, setPrompts] = useState<AiPrompt[]>(existingPrompts)
  const [selectedId, setSelectedId] = useState<string | null>(prompts[0]?.id || null)
  const [name, setName] = useState(prompts[0]?.name || '')
  const [systemPrompt, setSystemPrompt] = useState(
    prompts[0]?.system_prompt || defaultSystemPrompt
  )
  const [userTemplate, setUserTemplate] = useState(
    prompts[0]?.user_prompt_template || defaultUserPromptTemplate
  )
  const [temperature, setTemperature] = useState(prompts[0]?.temperature || 0.2)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function selectPrompt(prompt: AiPrompt) {
    setSelectedId(prompt.id)
    setName(prompt.name)
    setSystemPrompt(prompt.system_prompt)
    setUserTemplate(prompt.user_prompt_template)
    setTemperature(Number(prompt.temperature) || 0.2)
  }

  function newPrompt() {
    setSelectedId(null)
    setName('')
    setSystemPrompt(defaultSystemPrompt)
    setUserTemplate(defaultUserPromptTemplate)
    setTemperature(0.2)
  }

  async function handleSave() {
    if (!name.trim()) { setMessage('프롬프트 이름을 입력해주세요.'); return }
    setSaving(true)
    setMessage('')

    const supabase = createClient()
    const promptData = {
      user_id: userId,
      name,
      system_prompt: systemPrompt,
      user_prompt_template: userTemplate,
      temperature,
      model: 'anthropic/claude-opus-4-6',
    }

    if (selectedId) {
      const { error } = await supabase
        .from('ai_prompts')
        .update(promptData)
        .eq('id', selectedId)
        .eq('user_id', userId)

      if (error) { setMessage('저장 실패: ' + error.message); setSaving(false); return }
      setPrompts((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, ...promptData } : p))
      )
      setMessage('저장되었습니다.')
    } else {
      const { data, error } = await supabase
        .from('ai_prompts')
        .insert(promptData)
        .select()
        .single()

      if (error || !data) { setMessage('저장 실패: ' + (error?.message || '')); setSaving(false); return }
      setPrompts((prev) => [...prev, data])
      setSelectedId(data.id)
      setMessage('새 프롬프트가 저장되었습니다.')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selectedId || !confirm('이 프롬프트를 삭제할까요?')) return
    const supabase = createClient()
    await supabase.from('ai_prompts').delete().eq('id', selectedId).eq('user_id', userId)
    setPrompts((prev) => prev.filter((p) => p.id !== selectedId))
    newPrompt()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium">AI 프롬프트 설정</h2>
        <GlassButton variant="secondary" size="sm" onClick={newPrompt}>
          + 새 프롬프트
        </GlassButton>
      </div>

      <div className="flex gap-6">
        {/* Prompt list */}
        {prompts.length > 0 && (
          <div className="w-44 flex-shrink-0">
            <div className="flex flex-col gap-1">
              {prompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => selectPrompt(p)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                    selectedId === p.id ? 'nav-item-active font-medium' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt form */}
        <div className="flex-1 glass-card p-5">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs opacity-40 block mb-1">프롬프트 이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 도시계획 전문 분석"
                className="glass-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs opacity-40 block mb-1">시스템 프롬프트</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="glass-input w-full px-3 py-2 text-sm font-mono text-xs resize-y"
              />
            </div>

            <div>
              <label className="text-xs opacity-40 block mb-1">
                사용자 프롬프트 템플릿{' '}
                <span className="opacity-60">({"{{CONTENT}}"} 위치에 논문 내용 삽입)</span>
              </label>
              <textarea
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                rows={8}
                className="glass-input w-full px-3 py-2 text-sm font-mono text-xs resize-y"
              />
            </div>

            <div>
              <label className="text-xs opacity-40 block mb-1">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs opacity-30 mt-1">
                <span>0 (정확)</span>
                <span>1 (창의적)</span>
              </div>
            </div>

            {message && (
              <p className={`text-xs ${message.includes('실패') ? 'text-red-500' : 'text-emerald-600'}`}>
                {message}
              </p>
            )}

            <div className="flex gap-2 mt-1">
              <GlassButton onClick={handleSave} loading={saving} className="flex-1">
                저장
              </GlassButton>
              {selectedId && (
                <GlassButton variant="secondary" onClick={handleDelete}>
                  삭제
                </GlassButton>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
