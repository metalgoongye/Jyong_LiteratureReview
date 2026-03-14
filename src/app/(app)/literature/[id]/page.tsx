import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MetadataPanel } from '@/components/literature/MetadataPanel'
import { ContentSection } from '@/components/literature/ContentSection'
import { EvidenceBox } from '@/components/literature/EvidenceBox'
import { PdfViewerWrapper } from '@/components/literature/PdfViewerWrapper'
import { RetryExtract } from '@/components/literature/RetryExtract'
import { CausalDiagram } from '@/components/literature/CausalDiagram'
import { UserNotes } from '@/components/literature/UserNotes'
import { Badge } from '@/components/ui/Badge'
import { DeleteButton } from '@/components/literature/DeleteButton'
import { formatAuthors, formatYear } from '@/lib/utils/format'
import type { LiteratureContent, EmpiricalEvidence } from '@/types/literature'

const statusLabels = {
  pending: '대기',
  processing: '분석 중',
  completed: '완료',
  failed: '실패',
} as const

const statusVariants = {
  pending: 'default',
  processing: 'processing',
  completed: 'success',
  failed: 'error',
} as const

export default async function LiteratureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: lit } = await supabase
    .from('literature')
    .select('*')
    .eq('id', id)
    .eq('user_id', user!.id)
    .single()

  if (!lit) notFound()

  const [{ data: content }, { data: evidence }] = await Promise.all([
    supabase
      .from('literature_content')
      .select('*')
      .eq('literature_id', id)
      .order('section_order'),
    supabase
      .from('empirical_evidence')
      .select('*')
      .eq('literature_id', id)
      .order('sort_order'),
  ])

  const sections = (content || []) as LiteratureContent[]
  const evidenceItems = (evidence || []) as EmpiricalEvidence[]

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Topbar */}
      <div
        className="px-6 py-4 flex items-start justify-between gap-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="min-w-0">
          <h1 className="font-semibold text-base leading-snug truncate">
            {lit.title || lit.original_filename || '제목 없음'}
          </h1>
          <p className="text-xs opacity-50 mt-0.5">
            {formatAuthors(lit.authors)} · {formatYear(lit.year)}
            {lit.journal_name && ` · ${lit.journal_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DeleteButton literatureId={lit.id} />
          <Badge variant={statusVariants[lit.extraction_status as keyof typeof statusVariants]}>
            {statusLabels[lit.extraction_status as keyof typeof statusLabels]}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: PDF Viewer (45%) */}
        <div
          className="w-[45%] flex-shrink-0 overflow-auto"
          style={{ borderRight: '1px solid rgba(0,0,0,0.06)' }}
        >
          {lit.storage_path && lit.source_type === 'pdf' ? (
            <PdfViewerWrapper storagePath={lit.storage_path} literatureId={lit.id} />
          ) : (
            <div className="flex items-center justify-center h-full opacity-30">
              <div className="text-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-sm">PDF 미리보기 없음</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Extracted Content (55%) */}
        <div className="flex-1 overflow-auto p-6">
          {lit.extraction_status === 'pending' && (
            <div className="text-center py-12 opacity-40">
              <p className="text-sm">분석 대기 중...</p>
            </div>
          )}

          {lit.extraction_status === 'processing' && (
            <div className="text-center py-12 opacity-60">
              <div className="w-6 h-6 mx-auto mb-3">
                <svg className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-sm">AI 분석 중입니다...</p>
            </div>
          )}

          {lit.extraction_status === 'failed' && (
            <RetryExtract literatureId={lit.id} errorMessage={lit.ai_feedback} />
          )}

          {lit.extraction_status === 'completed' && (
            <>
              {/* Metadata */}
              <MetadataPanel literature={lit} />

              {/* Re-analyze button */}
              <div className="flex justify-end mb-4">
                <RetryExtract literatureId={lit.id} mode="reanalyze" />
              </div>

              {/* Evidence */}
              {evidenceItems.length > 0 && (
                <EvidenceBox evidence={evidenceItems} />
              )}

              {/* Causal diagram(s) */}
              {lit.causal_paths && (() => {
                const cp = lit.causal_paths as any
                const models = Array.isArray(cp) ? cp : [cp]
                return (
                  <div className="mb-6">
                    <h4 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-3 flex items-center gap-2">
                      인과 경로
                      <span className="px-1.5 py-0.5 rounded text-xs normal-case tracking-normal" style={{ background: 'rgba(99,102,241,0.12)', color: '#4338ca', fontSize: '10px' }}>
                        Causal Framework
                      </span>
                    </h4>
                    {models.map((model: any, i: number) => (
                      <CausalDiagram key={i} paths={model} showHeader={false} />
                    ))}
                  </div>
                )
              })()}

              {/* Personal notes */}
              <UserNotes literatureId={lit.id} initialNotes={lit.user_notes} />

              {/* Content sections */}
              {sections.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-4 mt-2">
                    핵심 내용
                  </h3>
                  {sections.map((section) => (
                    <ContentSection
                      key={section.id}
                      section={section}
                      language={lit.language || 'english'}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-40 text-center py-8">추출된 내용이 없습니다.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
