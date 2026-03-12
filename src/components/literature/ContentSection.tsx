'use client'

import { SECTION_LABELS } from '@/types/literature'
import type { LiteratureContent, PaperLanguage } from '@/types/literature'

interface ContentSectionProps {
  section: LiteratureContent
  language: PaperLanguage
}

export function ContentSection({ section, language }: ContentSectionProps) {
  const label = SECTION_LABELS[section.section_type] || section.section_type
  const originals = section.bullets_original || []
  const koreans = section.bullets_korean || []
  const isKorean = language === 'korean'

  if (originals.length === 0 && koreans.length === 0) return null

  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3">
        {label}
      </h4>
      <div className="flex flex-col gap-3">
        {originals.map((bullet, i) => (
          <div key={i} className="flex gap-3">
            <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#0a0a0a', opacity: 0.3 }} />
            <div className="flex-1 min-w-0">
              {/* Original text (black) */}
              <p className="text-original text-sm">
                {bullet.text}
                {bullet.page_ref && (
                  <span className="ml-2 text-xs opacity-30">(p.{bullet.page_ref})</span>
                )}
              </p>
              {/* Korean translation (gray) - only for non-Korean papers */}
              {!isKorean && koreans[i] && (
                <p className="text-korean text-sm mt-1">
                  {koreans[i].text}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
