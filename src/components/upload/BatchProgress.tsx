'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { Literature } from '@/types/literature'

interface BatchProgressProps {
  literatureIds: string[]
  batchJobId: string
  onComplete?: () => void
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function BatchProgress({ literatureIds, batchJobId, onComplete }: BatchProgressProps) {
  const { data: batchData } = useSWR(
    `/api/batch/${batchJobId}`,
    fetcher,
    { refreshInterval: 2000 }
  )

  const items: Literature[] = batchData?.literatureItems || []
  const batch = batchData?.batchJob

  const completedCount = items.filter(
    (i) => i.extraction_status === 'completed' || i.extraction_status === 'failed'
  ).length
  const total = literatureIds.length
  const overallProgress = total > 0 ? (completedCount / total) * 100 : 0

  const avgAccuracy =
    items.filter((i) => i.extraction_accuracy != null).length > 0
      ? items.reduce((acc, i) => acc + (i.extraction_accuracy || 0), 0) /
        items.filter((i) => i.extraction_accuracy != null).length
      : null

  useEffect(() => {
    if (batch?.overall_status === 'completed' && onComplete) {
      onComplete()
    }
  }, [batch?.overall_status, onComplete])

  const statusIcon = (status: string) => {
    if (status === 'completed')
      return <span className="text-emerald-400">✓</span>
    if (status === 'failed')
      return <span className="text-red-400">✗</span>
    if (status === 'processing')
      return (
        <svg className="w-3.5 h-3.5 animate-spin opacity-60" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )
    return <span className="opacity-30">○</span>
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overall progress */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">
          {completedCount} / {total} 완료
        </span>
        {avgAccuracy !== null && (
          <span className="text-xs opacity-60">평균 정확도 {avgAccuracy.toFixed(1)}%</span>
        )}
      </div>
      <ProgressBar value={overallProgress} size="md" />

      {/* Per-file status */}
      <div className="flex flex-col gap-1.5 mt-1">
        {literatureIds.map((id, i) => {
          const item = items.find((it) => it.id === id)
          const status = item?.extraction_status || 'pending'
          const accuracy = item?.extraction_accuracy

          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs opacity-30 w-4">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs opacity-70 truncate">
                  {item?.original_filename || item?.title || `파일 ${i + 1}`}
                </p>
              </div>
              {accuracy !== null && accuracy !== undefined && (
                <span className="text-xs opacity-50">{accuracy.toFixed(0)}%</span>
              )}
              <div className="flex items-center">{statusIcon(status)}</div>
              {status === 'completed' && (
                <Link
                  href={`/literature/${id}`}
                  className="text-xs opacity-40 hover:opacity-80 transition-opacity"
                >
                  보기 →
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* AI feedback summary */}
      {batch?.overall_status === 'completed' && items.length > 0 && (
        <div className="mt-2 rounded-lg p-3 text-xs opacity-60" style={{ background: 'rgba(212,255,0,0.05)', borderLeft: '2px solid rgba(212,255,0,0.4)' }}>
          <p className="font-medium mb-1 opacity-80">AI 자체 피드백</p>
          {items
            .filter((i) => i.ai_feedback)
            .slice(0, 3)
            .map((i) => (
              <p key={i.id} className="mb-1">
                · {i.original_filename || i.title}: {i.ai_feedback}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
