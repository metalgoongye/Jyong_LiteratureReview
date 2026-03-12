'use client'

import type { EmpiricalEvidence } from '@/types/literature'

interface EvidenceBoxProps {
  evidence: EmpiricalEvidence[]
}

export function EvidenceBox({ evidence }: EvidenceBoxProps) {
  if (!evidence || evidence.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3 flex items-center gap-2">
        실증 근거
        <span
          className="px-1.5 py-0.5 rounded text-xs normal-case tracking-normal"
          style={{ background: 'rgba(212,255,0,0.2)', color: '#5a6000', fontSize: '10px' }}
        >
          Empirical Evidence
        </span>
      </h4>
      <div className="flex flex-col gap-2.5">
        {evidence.map((ev) => (
          <div key={ev.id} className="evidence-box">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium leading-snug">{ev.evidence_text}</p>
              {ev.page_reference && (
                <span
                  className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(212,255,0,0.3)', fontSize: '10px' }}
                >
                  p.{ev.page_reference}
                </span>
              )}
            </div>
            {ev.evidence_text_korean && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: 'rgba(0,0,0,0.38)' }}>
                {ev.evidence_text_korean}
              </p>
            )}
            {ev.original_quote && ev.original_quote !== ev.evidence_text && (
              <p className="text-xs opacity-30 mt-1.5 italic leading-relaxed border-l-2 border-black/10 pl-2">
                &ldquo;{ev.original_quote}&rdquo;
              </p>
            )}
            {(ev.metric_value || ev.metric_unit) && (
              <div className="flex items-center gap-1 mt-1.5">
                {ev.metric_name && (
                  <span className="text-xs opacity-50">{ev.metric_name}:</span>
                )}
                <span className="text-xs font-semibold">
                  {ev.metric_value} {ev.metric_unit}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
