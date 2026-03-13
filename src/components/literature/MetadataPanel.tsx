'use client'

import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatAuthors } from '@/lib/utils/format'
import type { Literature } from '@/types/literature'

interface MetadataPanelProps {
  literature: Literature
}

export function MetadataPanel({ literature: lit }: MetadataPanelProps) {
  const metaRows = [
    { label: '저자', value: formatAuthors(lit.authors) },
    { label: '연도', value: lit.year?.toString() },
    { label: '저널', value: lit.journal_name },
    { label: '권(호)', value: [lit.volume, lit.issue ? `(${lit.issue})` : null].filter(Boolean).join('') || null },
    { label: '페이지', value: lit.pages },
    { label: '출판사', value: lit.publisher },
    { label: '출판국가', value: lit.country },
    { label: 'DOI', value: lit.doi },
  ].filter((r) => r.value)

  return (
    <div className="glass-card p-5 mb-4">
      {/* Fields */}
      {lit.fields && lit.fields.length > 0 && (
        <div className="mb-4">
          <p className="text-xs opacity-40 mb-2">분야</p>
          <div className="flex flex-wrap gap-1.5">
            {lit.fields.map((field) => (
              <span
                key={field}
                className="px-2.5 py-1 rounded-full text-xs"
                style={{ background: 'rgba(0,0,0,0.06)', fontSize: '11px' }}
              >
                {field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {metaRows.map((row) => (
          <div key={row.label}>
            <p className="text-xs opacity-35 mb-0.5">{row.label}</p>
            <p className="text-xs font-medium truncate">{row.value}</p>
          </div>
        ))}
      </div>

      {/* AI accuracy */}
      {lit.extraction_accuracy != null && (() => {
        const acc = lit.extraction_accuracy!
        const band = acc >= 90 ? 3 : acc >= 70 ? 7 : 12
        const lo = Math.max(0, acc - band).toFixed(0)
        const hi = Math.min(100, acc + band).toFixed(0)
        return (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs opacity-40">AI 추출 정확도</p>
              <Badge
                variant={
                  acc >= 90 ? 'success' : acc >= 70 ? 'warning' : 'error'
                }
              >
                {acc.toFixed(1)}%
              </Badge>
            </div>
            <p className="text-xs opacity-30 mb-2">추정 범위 {lo}% ~ {hi}%</p>
            <ProgressBar value={acc} size="sm" />
            {lit.ai_feedback && (
              <p className="text-xs opacity-40 mt-2 leading-relaxed">{lit.ai_feedback}</p>
            )}
          </div>
        )
      })()}
    </div>
  )
}
