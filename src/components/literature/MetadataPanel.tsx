'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatAuthors } from '@/lib/utils/format'
import type { Literature } from '@/types/literature'

interface MetadataPanelProps {
  literature: Literature
}

const SIX_IS_INDICATORS = [
  { key: 'accurate' as const, label: 'Accurate', reasonKey: 'accurate_reason' as const },
  { key: 'precise' as const, label: 'Precise', reasonKey: 'precise_reason' as const },
  { key: 'consistent' as const, label: 'Consistent', reasonKey: 'consistent_reason' as const },
  { key: 'coherent' as const, label: 'Coherent', reasonKey: 'coherent_reason' as const },
]

export function MetadataPanel({ literature: lit }: MetadataPanelProps) {
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [sixIs, setSixIs] = useState(lit.six_is_scores ?? null)
  const [accDetails, setAccDetails] = useState(lit.accuracy_details ?? null)
  const [accuracy, setAccuracy] = useState(lit.extraction_accuracy ?? null)

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

  async function handleVerify() {
    setVerifying(true)
    setVerifyError('')
    try {
      const res = await fetch(`/api/verify/${lit.id}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '검증 실패')
      setSixIs(data.six_is_scores)
      setAccDetails(data.accuracy_details)
      setAccuracy(data.accuracy_details.overall)
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setVerifying(false)
    }
  }

  const acc = accuracy

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

      {/* Quality verification section */}
      {lit.extraction_status === 'completed' && (
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          {/* Header row with verify button */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold opacity-60">품질 검증</p>
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
              style={{
                background: 'rgba(0,0,0,0.06)',
                opacity: verifying ? 0.5 : 1,
                cursor: verifying ? 'not-allowed' : 'pointer',
              }}
            >
              {verifying ? '검증 중...' : sixIs ? '재검증' : '검증하기'}
            </button>
          </div>

          {verifyError && (
            <p className="text-xs text-red-500 mb-2">{verifyError}</p>
          )}

          {/* AI 추출 정확도 */}
          {acc != null && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs opacity-40">AI 추출 정확도</p>
                <Badge variant={acc >= 90 ? 'success' : acc >= 70 ? 'warning' : 'error'}>
                  {acc.toFixed(1)}%
                </Badge>
              </div>
              {accDetails && (
                <div className="flex flex-col gap-1 mb-2">
                  {accDetails.abstract_alignment != null && (
                    <MiniBar label="Abstract 일치도" value={accDetails.abstract_alignment} />
                  )}
                  <MiniBar label="필드 완성도" value={accDetails.field_completeness} />
                </div>
              )}
              <ProgressBar value={acc} size="sm" />
              {lit.ai_feedback && !accDetails && (
                <p className="text-xs opacity-40 mt-2 leading-relaxed">{lit.ai_feedback}</p>
              )}
            </div>
          )}

          {/* Six Is scores */}
          {sixIs && (
            <div>
              <div
                className="flex items-center justify-between mb-2"
                style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10 }}
              >
                <p className="text-xs opacity-40">연구 엄밀성</p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background:
                      sixIs.grade === 'A'
                        ? 'rgba(22,163,74,0.12)'
                        : sixIs.grade === 'B'
                        ? 'rgba(217,119,6,0.12)'
                        : 'rgba(220,38,38,0.12)',
                    color:
                      sixIs.grade === 'A'
                        ? '#16a34a'
                        : sixIs.grade === 'B'
                        ? '#d97706'
                        : '#dc2626',
                  }}
                >
                  등급 {sixIs.grade} &nbsp;{sixIs.base_total}/400 pts
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {SIX_IS_INDICATORS.map(({ key, label, reasonKey }) => {
                  const val = sixIs[key]
                  const reason = sixIs[reasonKey]
                  const barColor = val >= 80 ? '#16a34a' : val >= 50 ? '#d97706' : '#dc2626'
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-20 opacity-50 flex-shrink-0">{label}</span>
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${val}%`, background: barColor, transition: 'width 0.3s' }}
                          />
                        </div>
                        <span className="text-xs w-6 text-right font-medium" style={{ color: barColor }}>
                          {val}
                        </span>
                      </div>
                      {reason && val < 80 && (
                        <p className="text-xs mt-0.5 ml-[88px] leading-relaxed" style={{ color: '#888' }}>
                          {reason}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Derived / holistic */}
              <div
                className="mt-2 pt-2 flex flex-col gap-1"
                style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-35">평균 (4개 지표)</span>
                  <span className="text-xs opacity-50">{sixIs.average.toFixed(1)}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-35">Overall (종합)</span>
                  <span className="text-xs opacity-50">{sixIs.overall}/100</span>
                </div>
                {sixIs.overall_reason && (
                  <p className="text-xs leading-relaxed" style={{ color: '#aaa' }}>
                    {sixIs.overall_reason}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs opacity-35 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div
          className="h-1 rounded-full"
          style={{ width: `${value}%`, background: 'rgba(0,0,0,0.25)' }}
        />
      </div>
      <span className="text-xs opacity-40 w-6 text-right">{value}</span>
    </div>
  )
}
