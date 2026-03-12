'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { GlassCard } from '@/components/ui/GlassCard'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatAuthors, formatYear } from '@/lib/utils/format'
import type { Literature } from '@/types/literature'

interface LiteratureCardProps {
  literature: Literature
}

const statusVariants = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
} as const

const statusLabels = {
  pending: '대기',
  processing: '분석 중',
  completed: '완료',
  failed: '실패',
}

export function LiteratureCard({ literature: lit }: LiteratureCardProps) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    await fetch(`/api/literature/${lit.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="relative group">
      {/* Trash button on hover */}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
        style={{ background: 'rgba(0,0,0,0.07)' }}
        title="휴지통으로 이동"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={deleting ? '#ccc' : '#666'} strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
      </button>

      <Link href={`/literature/${lit.id}`}>
        <GlassCard
          padding="md"
          className="h-full hover:scale-[1.01] transition-transform cursor-pointer group"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <Badge variant={statusVariants[lit.extraction_status]}>
              {statusLabels[lit.extraction_status]}
            </Badge>
            {lit.extraction_accuracy != null && (
              <span className="text-xs opacity-40">{lit.extraction_accuracy.toFixed(0)}%</span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-sm leading-snug mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity">
            {lit.title || (lit.original_filename ? lit.original_filename.replace('.pdf', '') : '제목 없음')}
          </h3>

          {/* Authors + Year */}
          <p className="text-xs opacity-50 mb-3">
            {formatAuthors(lit.authors)} · {formatYear(lit.year)}
            {lit.journal_name && ` · ${lit.journal_name}`}
          </p>

          {/* Field badges */}
          {lit.fields && lit.fields.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {lit.fields.slice(0, 3).map((field) => (
                <span
                  key={field}
                  className="inline-block px-2 py-0.5 rounded-full text-xs"
                  style={{ background: 'rgba(0,0,0,0.06)', fontSize: '10px' }}
                >
                  {field}
                </span>
              ))}
              {lit.fields.length > 3 && (
                <span className="text-xs opacity-30">+{lit.fields.length - 3}</span>
              )}
            </div>
          )}

          {/* Accuracy bar */}
          {lit.extraction_status === 'completed' && lit.extraction_accuracy != null && (
            <ProgressBar value={lit.extraction_accuracy} size="sm" />
          )}

          {/* Processing indicator */}
          {lit.extraction_status === 'processing' && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs opacity-40">AI 분석 중...</span>
            </div>
          )}
        </GlassCard>
      </Link>
    </div>
  )
}
