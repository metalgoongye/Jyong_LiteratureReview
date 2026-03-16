'use client'

import { useState, useEffect, useRef } from 'react'

interface LiteratureGap {
  topic: string
  location: string
  insertion_text: string
  new_references: string[]
}

interface ExpertReview {
  overall_assessment: string
  strengths: string[]
  major_concerns: string[]
  reviewer_responses: string[]
  gaps_summary: string
  literature_gaps: LiteratureGap[]
}

interface CprSession {
  id: string
  title: string | null
  status: string
  created_at: string
  synthesis_id: string | null
}

interface SynthesisMeta {
  id: string
  hypothesis: string
  title: string | null
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CprPage() {
  const [docFile, setDocFile] = useState<File | null>(null)
  const [reviewerComments, setReviewerComments] = useState('')
  const [reviewerFile, setReviewerFile] = useState<File | null>(null)
  const [synthesisId, setSynthesisId] = useState('')
  const [synthesisList, setSynthesisList] = useState<SynthesisMeta[]>([])
  const [sessions, setSessions] = useState<CprSession[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [error, setError] = useState('')
  const [expertReview, setExpertReview] = useState<ExpertReview | null>(null)
  const [annotatedHtml, setAnnotatedHtml] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAnnotated, setShowAnnotated] = useState(false)
  const docInputRef = useRef<HTMLInputElement>(null)
  const reviewerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadSessions()
    loadSyntheses()
  }, [])

  async function loadSessions() {
    const res = await fetch('/api/cpr')
    if (res.ok) {
      const data = await res.json()
      setSessions(data.sessions || [])
    }
  }

  async function loadSyntheses() {
    const res = await fetch('/api/synthesis')
    if (res.ok) {
      const data = await res.json()
      setSynthesisList(data.syntheses || [])
    }
  }

  async function loadSession(id: string) {
    setSessionLoading(true)
    setExpertReview(null)
    setAnnotatedHtml('')
    setError('')
    const res = await fetch(`/api/cpr/${id}`)
    if (!res.ok) { setSessionLoading(false); return }
    const data = await res.json()
    const s = data.session
    setSelectedId(id)
    setSynthesisId(s.synthesis_id || '')
    if (s.status === 'completed' && s.expert_review) {
      setExpertReview(s.expert_review)
      setAnnotatedHtml(s.annotated_html || '')
      setShowAnnotated(true)
    }
    setSessionLoading(false)
  }

  function resetForm() {
    setDocFile(null)
    setReviewerFile(null)
    setReviewerComments('')
    setSynthesisId('')
    setExpertReview(null)
    setAnnotatedHtml('')
    setError('')
    setSelectedId(null)
    setShowAnnotated(false)
    if (docInputRef.current) docInputRef.current.value = ''
    if (reviewerInputRef.current) reviewerInputRef.current.value = ''
  }

  async function handleAnalyze() {
    if (!docFile) {
      setError('논문 파일(.docx)을 먼저 업로드해 주세요')
      return
    }

    setUploading(true)
    setError('')
    setExpertReview(null)
    setAnnotatedHtml('')

    const formData = new FormData()
    formData.append('docFile', docFile)
    if (reviewerComments.trim()) formData.append('reviewerComments', reviewerComments)
    if (reviewerFile) formData.append('reviewerFile', reviewerFile)
    if (synthesisId) formData.append('synthesisId', synthesisId)

    let sessionId: string
    try {
      const res = await fetch('/api/cpr', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '업로드 실패')
      sessionId = data.id
      setSelectedId(sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 오류가 발생했습니다')
      setUploading(false)
      return
    }

    setUploading(false)
    setAnalyzing(true)
    await loadSessions()

    try {
      const res = await fetch(`/api/cpr/${sessionId}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '분석 실패')
      setExpertReview(data.expert_review)
      setAnnotatedHtml(data.annotated_html || '')
      setShowAnnotated(true)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '분석 중 오류가 발생했습니다')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleReanalyze() {
    if (!selectedId) return
    setAnalyzing(true)
    setError('')
    setExpertReview(null)
    setAnnotatedHtml('')
    setShowAnnotated(false)
    try {
      const res = await fetch(`/api/cpr/${selectedId}/analyze`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '재분석 실패')
      setExpertReview(data.expert_review)
      setAnnotatedHtml(data.annotated_html || '')
      setShowAnnotated(true)
      await loadSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '재분석 중 오류가 발생했습니다')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    await fetch(`/api/cpr/${id}`, { method: 'DELETE' })
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (selectedId === id) resetForm()
    setDeletingId(null)
  }

  async function downloadAnnotated() {
    if (!annotatedHtml) return
    const {
      Document: DocxDocument,
      Paragraph,
      TextRun,
      HeadingLevel,
      Packer,
    } = await import('docx')

    const parser = new DOMParser()
    const parsed = parser.parseFromString(annotatedHtml, 'text/html')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getRuns(el: Element): any[] {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runs: any[] = []
      el.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent || ''
          if (text.trim()) runs.push(new TextRun({ text }))
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const c = child as Element
          const style = c.getAttribute('style') || ''
          const isRed = style.includes('#dc2626') || style.includes('dc2626')
          const isBold = c.tagName === 'STRONG' || c.tagName === 'B'
          const isItalic = c.tagName === 'EM' || c.tagName === 'I' || style.includes('italic')
          const text = c.textContent || ''
          if (text) {
            runs.push(new TextRun({
              text,
              bold: isBold,
              italics: isRed || isItalic,
              color: isRed ? 'DC2626' : undefined,
            }))
          }
        }
      })
      return runs
    }

    // Detect bold-only paragraph = section heading (mammoth renders Word heading styles this way)
    function looksLikeHeading(el: Element): boolean {
      const text = el.textContent?.trim() || ''
      if (!text || text.length > 120) return false
      const strongText = Array.from(el.querySelectorAll('strong, b')).map((b) => b.textContent).join('')
      return strongText.trim() === text && text.length > 0
    }

    const children: InstanceType<typeof Paragraph>[] = []
    parsed.body.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      const runs = getRuns(el)
      if (tag === 'h1') {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 120 }, children: runs.length ? runs : [new TextRun(el.textContent || '')] }))
      } else if (tag === 'h2') {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 100 }, children: runs.length ? runs : [new TextRun(el.textContent || '')] }))
      } else if (tag === 'h3') {
        children.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 80 }, children: runs.length ? runs : [new TextRun(el.textContent || '')] }))
      } else if (tag === 'p' && runs.length) {
        if (looksLikeHeading(el)) {
          // Bold-only short paragraph → treat as sub-heading with spacing
          children.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 360, after: 80 },
            children: runs,
          }))
        } else {
          children.push(new Paragraph({ spacing: { after: 120 }, children: runs }))
        }
      }
    })

    if (children.length === 0) {
      children.push(new Paragraph({ children: [new TextRun(parsed.body.textContent || '')] }))
    }

    const docx = new DocxDocument({ sections: [{ children }] })
    const blob = await Packer.toBlob(docx)
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = 'CPR_annotated.docx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = uploading || analyzing

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sessions sidebar */}
      <aside
        className="w-52 flex-shrink-0 overflow-auto py-6 px-3 flex flex-col gap-1"
        style={{ borderRight: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider opacity-40">이전 세션</h2>
          <button
            onClick={resetForm}
            className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            title="새 세션"
          >
            + 새로
          </button>
        </div>

        {sessions.length === 0 && (
          <p className="text-xs opacity-30 px-1">세션 없음</p>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => loadSession(s.id)}
            className="group relative rounded-xl px-2 py-2 cursor-pointer transition-all"
            style={{ background: selectedId === s.id ? 'rgba(0,0,0,0.07)' : 'transparent' }}
            onMouseEnter={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
            onMouseLeave={(e) => { if (selectedId !== s.id) e.currentTarget.style.background = 'transparent' }}
          >
            <p className="text-xs font-medium truncate pr-4" style={{ maxWidth: 140 }}>{s.title || '제목 없음'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-xs opacity-35">{formatDate(s.created_at)}</p>
              {s.status === 'completed' && <span className="text-xs" style={{ color: '#16a34a' }}>✓</span>}
              {s.status === 'analyzing' && <span className="text-xs opacity-40">분석중</span>}
            </div>
            <button
              onClick={(e) => handleDelete(s.id, e)}
              disabled={deletingId === s.id}
              className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity p-1"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-xl font-semibold">CPR</h1>
            <p className="text-xs opacity-40 mt-0.5">논문 소생 — 선행연구 보강 + AI 전문가 리뷰</p>
          </div>

          {/* Upload section — only when no session selected */}
          {!selectedId && !expertReview && (
            <div className="glass-card p-5 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Doc file */}
                <div>
                  <p className="text-xs font-semibold opacity-60 mb-2">논문 파일 (.docx)</p>
                  <label
                    className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all"
                    style={{
                      border: '2px dashed rgba(0,0,0,0.12)',
                      minHeight: 100,
                      background: docFile ? 'rgba(0,0,0,0.03)' : 'transparent',
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      const f = e.dataTransfer.files[0]
                      if (f?.name.endsWith('.docx')) setDocFile(f)
                    }}
                  >
                    <input
                      ref={docInputRef}
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                    />
                    {docFile ? (
                      <div className="text-center px-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 opacity-60">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <p className="text-xs font-medium opacity-70 truncate max-w-[130px]">{docFile.name}</p>
                      </div>
                    ) : (
                      <div className="text-center px-2">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-1 opacity-30">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p className="text-xs opacity-30">드래그 또는 클릭</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Reviewer comments */}
                <div>
                  <p className="text-xs font-semibold opacity-60 mb-2">리뷰어 코멘트 (선택)</p>
                  <textarea
                    value={reviewerComments}
                    onChange={(e) => setReviewerComments(e.target.value)}
                    placeholder="리뷰어 코멘트를 직접 입력하거나..."
                    className="glass-input w-full text-xs resize-none rounded-xl p-2"
                    style={{ minHeight: 80, fontSize: 12 }}
                  />
                  <label className="mt-1 flex items-center gap-1.5 cursor-pointer opacity-50 hover:opacity-70 transition-opacity">
                    <input
                      ref={reviewerInputRef}
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={(e) => setReviewerFile(e.target.files?.[0] || null)}
                    />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span className="text-xs">{reviewerFile ? reviewerFile.name : '.docx 파일로 업로드'}</span>
                  </label>
                </div>

                {/* Synthesis link */}
                <div>
                  <p className="text-xs font-semibold opacity-60 mb-2">Synthesis 연결 (선택)</p>
                  <select
                    value={synthesisId}
                    onChange={(e) => setSynthesisId(e.target.value)}
                    className="glass-input w-full text-xs rounded-xl px-2 py-2"
                    style={{ fontSize: 12 }}
                  >
                    <option value="">— 선택 안 함</option>
                    {synthesisList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || s.hypothesis.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                  {synthesisId && (
                    <p className="text-xs opacity-40 mt-1.5 leading-relaxed">
                      Synthesis의 문헌 근거를 논문 초안에 보강 제안합니다
                    </p>
                  )}
                </div>
              </div>

              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

              <div className="flex justify-center">
                <button
                  onClick={handleAnalyze}
                  disabled={isLoading || !docFile}
                  className="glass-button-primary px-6 py-2.5 text-sm rounded-xl"
                  style={{ opacity: isLoading || !docFile ? 0.5 : 1, cursor: isLoading || !docFile ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? '파일 처리 중...' : analyzing ? 'AI 분석 중...' : 'AI 분석 시작'}
                </button>
              </div>
            </div>
          )}

          {/* Session loading */}
          {sessionLoading && (
            <div className="glass-card p-8 text-center mb-4">
              <div className="inline-block w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin opacity-30 mb-2" />
              <p className="text-xs opacity-40">불러오는 중...</p>
            </div>
          )}

          {/* Session selected but no results — re-analyze */}
          {selectedId && !expertReview && !sessionLoading && !isLoading && (
            <div className="glass-card p-8 text-center mb-4">
              <p className="text-sm opacity-40 mb-3">저장된 결과가 없습니다</p>
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-70"
                style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb' }}
              >
                ↻ 재분석 실행
              </button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="glass-card p-8 text-center mb-4">
              <div className="inline-block w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40 mb-3" />
              <p className="text-sm opacity-50">
                {uploading ? '문서 파싱 중...' : 'AI가 논문을 분석하고 문헌 보강 제안을 생성하고 있습니다...'}
              </p>
              <p className="text-xs opacity-30 mt-1">1~2분 소요될 수 있습니다</p>
            </div>
          )}

          {/* Results */}
          {expertReview && !isLoading && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold opacity-70">분석 결과</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReanalyze}
                    disabled={analyzing}
                    className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
                    style={{ background: 'rgba(37,99,235,0.08)', color: '#2563eb', opacity: analyzing ? 0.4 : 1 }}
                  >
                    ↻ 재분석
                  </button>
                  <button
                    onClick={resetForm}
                    className="text-xs opacity-40 hover:opacity-70 transition-opacity px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(0,0,0,0.06)' }}
                  >
                    + 새 분석
                  </button>
                </div>
              </div>

              {/* Literature gaps — primary feature */}
              {(expertReview.literature_gaps?.length > 0 || expertReview.gaps_summary) && (
                <div className="glass-card p-5 mb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p className="text-xs font-semibold" style={{ color: '#2563eb' }}>선행연구 보강 제안</p>
                  </div>

                  {expertReview.gaps_summary && (
                    <p className="text-xs opacity-60 leading-relaxed mb-4">{expertReview.gaps_summary}</p>
                  )}

                  <div className="flex flex-col gap-4">
                    {(expertReview.literature_gaps || []).map((gap, i) => (
                      <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(37,99,235,0.04)', border: '1px solid rgba(37,99,235,0.1)' }}>
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: '#2563eb' }}>#{i + 1}</span>
                          <p className="text-xs font-semibold opacity-80">{gap.topic}</p>
                        </div>

                        <p className="text-xs opacity-40 mb-1 ml-4">삽입 위치: &ldquo;{gap.location}&hellip;&rdquo; 뒤</p>

                        <div className="ml-4 rounded-lg p-2 mb-2" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)' }}>
                          <p className="text-xs mb-1 opacity-40">제안 삽입 문장:</p>
                          <p className="text-xs leading-relaxed" style={{ color: '#dc2626', fontStyle: 'italic' }}>{gap.insertion_text}</p>
                        </div>

                        {gap.new_references?.length > 0 && (
                          <div className="ml-4">
                            <p className="text-xs opacity-30 mb-1">참고문헌:</p>
                            {gap.new_references.map((ref, j) => (
                              <p key={j} className="text-xs leading-relaxed" style={{ color: '#dc2626', opacity: 0.7 }}>▸ {ref}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expert review summary */}
              <div className="glass-card p-4 mb-3">
                <p className="text-xs font-semibold opacity-50 mb-2">전반적 평가</p>
                <p className="text-xs leading-relaxed opacity-70">{expertReview.overall_assessment}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                {expertReview.strengths?.length > 0 && (
                  <div className="glass-card p-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#16a34a' }}>강점</p>
                    <ul className="flex flex-col gap-1.5">
                      {expertReview.strengths.map((s, i) => (
                        <li key={i} className="text-xs leading-relaxed flex gap-2">
                          <span style={{ color: '#16a34a' }} className="flex-shrink-0">✓</span>
                          <span className="opacity-70">{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {expertReview.major_concerns?.length > 0 && (
                  <div className="glass-card p-4">
                    <p className="text-xs font-semibold mb-2" style={{ color: '#d97706' }}>주요 지적사항</p>
                    <ul className="flex flex-col gap-1.5">
                      {expertReview.major_concerns.map((c, i) => (
                        <li key={i} className="text-xs leading-relaxed flex gap-2">
                          <span style={{ color: '#d97706' }} className="flex-shrink-0">⚠</span>
                          <span className="opacity-70">{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {expertReview.reviewer_responses?.length > 0 && (
                <div className="glass-card p-4 mb-3">
                  <p className="text-xs font-semibold opacity-50 mb-2">리뷰어 코멘트 대응 전략</p>
                  <ul className="flex flex-col gap-2">
                    {expertReview.reviewer_responses.map((r, i) => (
                      <li key={i} className="text-xs leading-relaxed">
                        <span className="font-medium opacity-40 mr-1">#{i + 1}</span>
                        <span className="opacity-70">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Annotated document */}
              {annotatedHtml && (
                <div className="glass-card p-4 mb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-semibold opacity-50">주석 문서 미리보기</p>
                      <p className="text-xs opacity-30 mt-0.5">
                        <span style={{ color: '#dc2626' }}>붉은 글씨</span> = synthesis 근거 삽입 문장 (본문에 바로 통합 가능)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowAnnotated((v) => !v)}
                        className="text-xs opacity-40 hover:opacity-70 transition-opacity px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.06)' }}
                      >
                        {showAnnotated ? '접기' : '펼치기'}
                      </button>
                      <button
                        onClick={downloadAnnotated}
                        className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-70"
                        style={{ background: 'rgba(0,0,0,0.06)' }}
                      >
                        .docx 다운로드
                      </button>
                    </div>
                  </div>
                  {showAnnotated && (
                    <div
                      className="doc-preview overflow-auto rounded-xl p-5"
                      style={{
                        background: '#fafaf9',
                        maxHeight: 600,
                        fontFamily: '"Times New Roman", Georgia, serif',
                        fontSize: 13,
                        lineHeight: 1.9,
                        color: '#111',
                      }}
                      dangerouslySetInnerHTML={{ __html: annotatedHtml }}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state — only when nothing selected */}
          {!selectedId && !expertReview && !isLoading && !docFile && (
            <div className="glass-card p-12 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 opacity-20">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              <p className="text-sm opacity-30">논문 .docx 파일을 업로드하면</p>
              <p className="text-xs opacity-20 mt-1">부족한 선행연구를 찾아 삽입 위치와 참고문헌까지 제안합니다</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
