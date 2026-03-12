'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function RetryExtract({
  literatureId,
  errorMessage,
  mode = 'failed',
}: {
  literatureId: string
  errorMessage?: string | null
  mode?: 'failed' | 'reanalyze'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRetry() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ literatureId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '분석 실패')
      } else {
        router.refresh()
      }
    } catch {
      setError('네트워크 오류')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'reanalyze') {
    return (
      <div className="flex items-center gap-2">
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={handleRetry}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{
            background: 'rgba(0,0,0,0.06)',
            color: loading ? '#bbb' : '#555',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '재분석 중...' : '↺ 재분석'}
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 text-center">
      <p className="text-sm text-red-500 mb-3">분석에 실패했습니다.</p>
      {errorMessage && (
        <p className="text-xs text-gray-400 mb-4 max-w-md mx-auto break-words">{errorMessage}</p>
      )}
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      <button
        onClick={handleRetry}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
        style={{
          background: loading ? 'rgba(0,0,0,0.06)' : '#111',
          color: loading ? '#999' : 'white',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '분석 중...' : '다시 시도 →'}
      </button>
    </div>
  )
}
