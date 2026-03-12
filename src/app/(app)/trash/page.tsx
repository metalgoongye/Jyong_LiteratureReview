'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatAuthors, formatYear } from '@/lib/utils/format'
import type { Literature } from '@/types/literature'

export default function TrashPage() {
  const [items, setItems] = useState<Literature[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const loadTrash = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('literature')
      .select('*')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    setItems(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTrash() }, [loadTrash])

  async function handleRestore(id: string) {
    setActionId(id)
    await fetch(`/api/literature/${id}/restore`, { method: 'POST' })
    await loadTrash()
    setActionId(null)
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('완전히 삭제하면 복구할 수 없습니다. 삭제하시겠습니까?')) return
    setActionId(id)
    await fetch(`/api/literature/${id}/permanent`, { method: 'DELETE' })
    await loadTrash()
    setActionId(null)
  }

  async function handleEmptyTrash() {
    if (!confirm(`휴지통의 문헌 ${items.length}개를 모두 완전히 삭제하시겠습니까?`)) return
    for (const item of items) {
      await fetch(`/api/literature/${item.id}/permanent`, { method: 'DELETE' })
    }
    setItems([])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-sm opacity-40">불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">휴지통</h1>
          <p className="text-xs opacity-40 mt-0.5">{items.length}개 항목</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="text-xs px-3 py-2 rounded-lg transition-colors"
            style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
          >
            휴지통 비우기
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="p-16 text-center rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <svg
            width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5"
            className="mx-auto mb-3 opacity-20"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
          <p className="text-sm opacity-30">휴지통이 비어 있습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((lit) => (
            <div
              key={lit.id}
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl"
              style={{
                background: 'rgba(255,255,255,0.55)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {lit.title || (lit.original_filename?.replace('.pdf', '') ?? '제목 없음')}
                </p>
                <p className="text-xs opacity-40 mt-0.5">
                  {formatAuthors(lit.authors)} · {formatYear(lit.year)}
                  {lit.deleted_at && (
                    <> · 삭제됨 {new Date(lit.deleted_at).toLocaleDateString('ko-KR')}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRestore(lit.id)}
                  disabled={actionId === lit.id}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: 'rgba(0,0,0,0.07)', color: '#333' }}
                >
                  복구
                </button>
                <button
                  onClick={() => handlePermanentDelete(lit.id)}
                  disabled={actionId === lit.id}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                >
                  완전 삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
