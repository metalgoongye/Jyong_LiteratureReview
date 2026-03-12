'use client'

import { useState, useRef } from 'react'

export function UserNotes({
  literatureId,
  initialNotes,
}: {
  literatureId: string
  initialNotes?: string | null
}) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save(value: string) {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`/api/literature/${literatureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_notes: value }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNotes(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(val), 1200)
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider opacity-40">메모</h4>
        {saving && <span className="text-xs opacity-30">저장 중...</span>}
        {!saving && saved && <span className="text-xs opacity-30">저장됨</span>}
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="이 논문에 대한 개인 메모를 작성하세요..."
        rows={4}
        className="w-full text-sm resize-none rounded-xl p-3 outline-none transition-all"
        style={{
          background: 'rgba(0,0,0,0.03)',
          border: '1px solid rgba(0,0,0,0.08)',
          color: '#333',
          lineHeight: '1.6',
        }}
        onFocus={(e) => {
          e.target.style.border = '1px solid rgba(0,0,0,0.2)'
        }}
        onBlur={(e) => {
          e.target.style.border = '1px solid rgba(0,0,0,0.08)'
          if (timerRef.current) clearTimeout(timerRef.current)
          save(notes)
        }}
      />
    </div>
  )
}
