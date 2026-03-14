'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteButton({ literatureId }: { literatureId: string }) {
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await fetch(`/api/literature/${literatureId}`, { method: 'DELETE' })
    router.push('/literature')
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs opacity-50">삭제할까요?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
        >
          {loading ? '삭제 중...' : '삭제'}
        </button>
        <button
          onClick={() => setConfirm(false)}
          className="text-xs px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(0,0,0,0.06)', color: '#555' }}
        >
          취소
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-xs px-2.5 py-1 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
      style={{ background: 'rgba(0,0,0,0.06)' }}
    >
      삭제
    </button>
  )
}
