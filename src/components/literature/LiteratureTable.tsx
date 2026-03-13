'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatAuthors } from '@/lib/utils/format'
import type { Literature } from '@/types/literature'

const statusLabel: Record<string, string> = {
  pending: '대기',
  processing: '분석중',
  completed: '완료',
  failed: '실패',
}

const statusVariant: Record<string, 'default' | 'success' | 'warning' | 'error' | 'processing'> = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
}

interface Props {
  items: Literature[]
}

export function LiteratureTable({ items }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.02)' }}>
            {['제목', '저자', '연도', '저널', '권(호)', '페이지', '분야', '상태', '정확도'].map((col) => (
              <th
                key={col}
                style={{
                  padding: '10px 14px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  opacity: 0.45,
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((lit, idx) => {
            const acc = lit.extraction_accuracy
            const accColor = acc == null ? undefined : acc >= 90 ? '#16a34a' : acc >= 70 ? '#d97706' : '#dc2626'
            return (
              <tr
                key={lit.id}
                style={{
                  borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  transition: 'background 0.1s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {/* 제목 */}
                <td style={{ padding: '10px 14px', maxWidth: 260 }}>
                  <Link href={`/literature/${lit.id}`} className="hover:underline font-medium" style={{ fontSize: 13 }}>
                    <span style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {lit.title || lit.original_filename || '제목 없음'}
                    </span>
                  </Link>
                </td>
                {/* 저자 */}
                <td style={{ padding: '10px 14px', opacity: 0.65, whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatAuthors(lit.authors) || '—'}
                </td>
                {/* 연도 */}
                <td style={{ padding: '10px 14px', opacity: 0.65, whiteSpace: 'nowrap' }}>
                  {lit.year || '—'}
                </td>
                {/* 저널 */}
                <td style={{ padding: '10px 14px', opacity: 0.65, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {lit.journal_name || '—'}
                </td>
                {/* 권(호) */}
                <td style={{ padding: '10px 14px', opacity: 0.65, whiteSpace: 'nowrap' }}>
                  {lit.volume ? `${lit.volume}${lit.issue ? `(${lit.issue})` : ''}` : '—'}
                </td>
                {/* 페이지 */}
                <td style={{ padding: '10px 14px', opacity: 0.65, whiteSpace: 'nowrap' }}>
                  {lit.pages || '—'}
                </td>
                {/* 분야 */}
                <td style={{ padding: '10px 14px', maxWidth: 120 }}>
                  {lit.fields?.length ? (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)', whiteSpace: 'nowrap' }}>
                      {lit.fields[0]}{lit.fields.length > 1 ? ` +${lit.fields.length - 1}` : ''}
                    </span>
                  ) : '—'}
                </td>
                {/* 상태 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <Badge variant={statusVariant[lit.extraction_status] || 'default'}>
                    {statusLabel[lit.extraction_status] || lit.extraction_status}
                  </Badge>
                </td>
                {/* 정확도 */}
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  {acc != null ? (
                    <span style={{ color: accColor, fontWeight: 500, fontSize: 13 }}>
                      {acc.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
