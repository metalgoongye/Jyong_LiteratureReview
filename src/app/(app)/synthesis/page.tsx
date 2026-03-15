'use client'

import { useState, useEffect } from 'react'
import jsPDF from 'jspdf'

interface Section {
  heading: string
  content: string
}

interface SynthesisResult {
  title: string
  hypothesis: string
  sections: Section[]
  references: string[]
}

interface CitationIssue {
  claim: string
  issue: string
  severity: 'high' | 'medium' | 'low'
}

interface SynthesisReview {
  overall_reliability: number
  verdict: string
  citation_issues: CitationIssue[]
  evidence_gaps: string[]
  unsupported_claims: string[]
  strengths: string[]
}

interface SynthesisMeta {
  id: string
  hypothesis: string
  title: string | null
  created_at: string
}

function generateWordHTML(result: SynthesisResult): string {
  const sectionsHTML = result.sections.map((s) => `
    <h2 style="font-size:14pt; font-weight:bold; margin-top:16pt;">${s.heading}</h2>
    <p style="margin-top:6pt; line-height:1.6;">${s.content}</p>
  `).join('')

  const refsHTML = result.references.map((r, i) =>
    `<p style="margin-top:4pt; font-size:10pt;">${i + 1}. ${r}</p>`
  ).join('')

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: 'Times New Roman', serif; font-size:12pt; margin:2.5cm;">
      <h1 style="font-size:16pt; font-weight:bold; text-align:center;">${result.title}</h1>
      <p style="margin-top:8pt; font-style:italic; color:#555;"><b>Hypothesis:</b> ${result.hypothesis}</p>
      <hr style="margin:16pt 0;" />
      ${sectionsHTML}
      <hr style="margin:16pt 0;" />
      <h2 style="font-size:14pt; font-weight:bold;">References</h2>
      ${refsHTML}
    </body>
    </html>
  `
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SynthesisPage() {
  const [hypothesis, setHypothesis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SynthesisResult | null>(null)
  const [history, setHistory] = useState<SynthesisMeta[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [review, setReview] = useState<SynthesisReview | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [improveLoading, setImproveLoading] = useState(false)
  const [improveError, setImproveError] = useState('')
  const [improveDismissed, setImproveDismissed] = useState(false)

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    setLoadingHistory(true)
    try {
      const res = await fetch('/api/synthesis')
      const data = await res.json()
      setHistory(data.syntheses || [])
    } finally {
      setLoadingHistory(false)
    }
  }

  async function loadSynthesis(id: string) {
    setSelectedId(id)
    setResult(null)
    setError('')
    setReview(null)
    setReviewError('')
    setImproveError('')
    setImproveDismissed(false)
    try {
      const res = await fetch(`/api/synthesis/${id}`)
      const data = await res.json()
      if (data.synthesis) {
        setResult(data.synthesis.result)
        setHypothesis(data.synthesis.hypothesis)
      }
    } catch {
      setError('불러오기 실패')
    }
  }

  async function handleSynthesize() {
    if (!hypothesis.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSelectedId(null)
    setReview(null)
    setReviewError('')
    setImproveError('')
    setImproveDismissed(false)
    try {
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesis }),
      })
      const text = await res.text()
      let data: { result?: SynthesisResult; error?: string; id?: string }
      try { data = JSON.parse(text) } catch { throw new Error('서버 응답 오류') }
      if (!res.ok) throw new Error(data.error || '합성 실패')
      setResult(data.result!)
      if (data.id) setSelectedId(data.id)
      await fetchHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await fetch(`/api/synthesis/${id}`, { method: 'DELETE' })
      setHistory((prev) => prev.filter((h) => h.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setResult(null)
        setHypothesis('')
      }
    } finally {
      setDeletingId(null)
    }
  }

  function handleNew() {
    setSelectedId(null)
    setResult(null)
    setHypothesis('')
    setError('')
    setReview(null)
    setReviewError('')
    setImproveError('')
    setImproveDismissed(false)
  }

  async function handleImprove() {
    if (!selectedId || !review) return
    setImproveLoading(true)
    setImproveError('')
    try {
      const res = await fetch(`/api/synthesis/${selectedId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '개선 실패')
      setResult(data.result)
      setReview(null)
      setImproveDismissed(false)
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : '개선 오류')
    } finally {
      setImproveLoading(false)
    }
  }

  async function handleReview() {
    if (!selectedId) return
    setReviewLoading(true)
    setReviewError('')
    setReview(null)
    setImproveDismissed(false)
    setImproveError('')
    try {
      const res = await fetch(`/api/synthesis/${selectedId}/review`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '검증 실패')
      setReview(data.review)
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : '검증 오류')
    } finally {
      setReviewLoading(false)
    }
  }

  function exportPDF() {
    if (!result) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxW = pageW - margin * 2
    let y = 20

    const addText = (text: string, fontSize: number, bold: boolean, color: [number, number, number] = [0, 0, 0]) => {
      doc.setFontSize(fontSize)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(...color)
      const lines = doc.splitTextToSize(text, maxW)
      lines.forEach((line: string) => {
        if (y > 270) { doc.addPage(); y = 20 }
        doc.text(line, margin, y)
        y += fontSize * 0.45
      })
    }

    const addSpacing = (mm: number) => { y += mm }

    // Title
    addText(result.title, 16, true)
    addSpacing(6)

    // Hypothesis
    addText('Hypothesis:', 10, true, [80, 80, 80])
    addSpacing(1)
    addText(result.hypothesis, 10, false, [80, 80, 80])
    addSpacing(8)

    // Divider
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageW - margin, y)
    addSpacing(8)

    // Sections
    result.sections.forEach((section) => {
      addText(section.heading, 12, true)
      addSpacing(3)
      addText(section.content, 10, false)
      addSpacing(7)
    })

    // References
    if (result.references.length > 0) {
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, pageW - margin, y)
      addSpacing(8)
      addText('References', 12, true)
      addSpacing(4)
      result.references.forEach((ref, i) => {
        addText(`${i + 1}. ${ref}`, 9, false, [80, 80, 80])
        addSpacing(2)
      })
    }

    const filename = result.title.replace(/[^a-zA-Z0-9가-힣 ]/g, '').slice(0, 50).trim() || 'synthesis'
    doc.save(`${filename}.pdf`)
  }

  function exportWord() {
    if (!result) return
    const html = generateWordHTML(result)
    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `synthesis_${Date.now()}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        {/* History sidebar */}
        <aside
          className="w-56 flex-shrink-0 flex flex-col overflow-hidden no-print"
          style={{ borderRight: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wider opacity-40">저장된 합성</h2>
            <button
              onClick={handleNew}
              className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80"
              style={{ background: 'rgba(0,0,0,0.06)' }}
            >
              + 새로
            </button>
          </div>

          <div className="flex-1 overflow-auto py-2">
            {loadingHistory ? (
              <p className="text-xs opacity-30 px-4 py-3">불러오는 중...</p>
            ) : history.length === 0 ? (
              <p className="text-xs opacity-30 px-4 py-3">저장된 합성이 없습니다</p>
            ) : (
              history.map((h) => (
                <div
                  key={h.id}
                  onClick={() => loadSynthesis(h.id)}
                  className="px-3 py-2.5 mx-2 mb-0.5 rounded-lg cursor-pointer group relative"
                  style={{
                    background: selectedId === h.id ? 'rgba(0,0,0,0.07)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== h.id) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== h.id) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <p className="text-xs font-medium leading-snug pr-5" style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {h.title || h.hypothesis}
                  </p>
                  <p className="text-xs opacity-30 mt-0.5">{formatDate(h.created_at)}</p>
                  <button
                    onClick={(e) => handleDelete(h.id, e)}
                    disabled={deletingId === h.id}
                    className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity"
                    title="삭제"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          {/* Header */}
          <div className="mb-8 no-print">
            <h1 className="text-2xl font-semibold">Synthesis</h1>
            <p className="text-sm opacity-50 mt-0.5">가설 기반 근거 합성 — Evidence-backed Research Proposal</p>
          </div>

          {/* Input */}
          <div className="glass-card p-6 mb-6 no-print" style={{ maxWidth: '56rem' }}>
            <label className="block text-xs opacity-50 mb-2 uppercase tracking-wider">연구 가설</label>
            <textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="예: 불평등이 urban sprawl에 영향을 미치고, 이는 탄소 배출량 증가로 이어진다."
              className="w-full p-3 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', minHeight: 100 }}
              rows={4}
            />
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <button
              onClick={handleSynthesize}
              disabled={loading || !hypothesis.trim()}
              className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: loading || !hypothesis.trim() ? 'rgba(0,0,0,0.08)' : '#111',
                color: loading || !hypothesis.trim() ? '#999' : 'white',
                cursor: loading || !hypothesis.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '분석 중...' : '근거 합성 →'}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div style={{ maxWidth: '56rem' }}>
              {/* Export + Review buttons */}
              <div className="flex gap-3 mb-4 no-print flex-wrap">
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  PDF 저장
                </button>
                <button
                  onClick={exportWord}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(0,0,0,0.06)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Word 저장
                </button>
                {selectedId && (
                  <button
                    onClick={handleReview}
                    disabled={reviewLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80 ml-auto"
                    style={{
                      background: reviewLoading ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.1)',
                      color: '#4338ca',
                      cursor: reviewLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    {reviewLoading ? 'AI 검증 중...' : 'AI 자가검증'}
                  </button>
                )}
              </div>

              <div className="glass-card p-8 print-area">
                <h2 className="text-xl font-bold mb-2 leading-snug">{result.title}</h2>
                <p className="text-sm mb-6 leading-relaxed" style={{ color: '#555', fontStyle: 'italic' }}>
                  <span className="font-semibold not-italic" style={{ color: '#333' }}>Hypothesis: </span>
                  {result.hypothesis}
                </p>

                <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 24 }}>
                  {result.sections.map((section, i) => (
                    <div key={i} className="mb-7">
                      <h3 className="text-base font-semibold mb-2">{section.heading}</h3>
                      <p className="text-sm leading-relaxed opacity-80">{section.content}</p>
                    </div>
                  ))}
                </div>

                {result.references.length > 0 && (
                  <div className="mt-8 pt-6" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                    <h3 className="text-base font-semibold mb-4">References</h3>
                    <div className="flex flex-col gap-2">
                      {result.references.map((ref, i) => (
                        <p key={i} className="text-xs leading-relaxed" style={{ opacity: 0.65, paddingLeft: '1.5em', textIndent: '-1.5em' }}>
                          {ref}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Review error */}
              {reviewError && (
                <p className="text-red-500 text-xs mt-3 no-print">{reviewError}</p>
              )}

              {/* Review panel */}
              {review && (
                <div className="mt-6 no-print rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.03)' }}>
                  {/* Header */}
                  <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)', background: 'rgba(99,102,241,0.06)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-sm font-semibold" style={{ color: '#4338ca' }}>AI 자가검증 결과</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-xs" style={{ color: '#4338ca', opacity: 0.6 }}>신뢰도</span>
                      <span className="text-lg font-bold" style={{ color: review.overall_reliability >= 75 ? '#16a34a' : review.overall_reliability >= 50 ? '#d97706' : '#dc2626' }}>
                        {review.overall_reliability}
                      </span>
                      <span className="text-xs" style={{ color: '#4338ca', opacity: 0.5 }}>/100</span>
                    </div>
                  </div>

                  <div className="px-6 py-5 flex flex-col gap-5">
                    {/* Verdict */}
                    <p className="text-sm leading-relaxed" style={{ color: '#333' }}>{review.verdict}</p>

                    {/* Citation issues */}
                    {review.citation_issues?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#dc2626', opacity: 0.8 }}>인용 문제</h4>
                        <div className="flex flex-col gap-2">
                          {review.citation_issues.map((issue, i) => (
                            <div key={i} className="rounded-lg p-3" style={{
                              background: issue.severity === 'high' ? 'rgba(220,38,38,0.06)' : issue.severity === 'medium' ? 'rgba(217,119,6,0.06)' : 'rgba(0,0,0,0.03)',
                              borderLeft: `3px solid ${issue.severity === 'high' ? '#dc2626' : issue.severity === 'medium' ? '#d97706' : '#9ca3af'}`,
                            }}>
                              <p className="text-xs font-medium mb-1" style={{ color: issue.severity === 'high' ? '#dc2626' : issue.severity === 'medium' ? '#d97706' : '#6b7280' }}>
                                [{issue.severity.toUpperCase()}]
                              </p>
                              <p className="text-xs mb-1 opacity-70" style={{ fontStyle: 'italic' }}>"{issue.claim}"</p>
                              <p className="text-xs" style={{ color: '#444' }}>{issue.issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unsupported claims */}
                    {review.unsupported_claims?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#d97706', opacity: 0.8 }}>근거 초과 주장</h4>
                        <ul className="flex flex-col gap-1">
                          {review.unsupported_claims.map((c, i) => (
                            <li key={i} className="text-xs pl-3" style={{ color: '#555', borderLeft: '2px solid rgba(217,119,6,0.4)' }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evidence gaps */}
                    {review.evidence_gaps?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>미활용 근거</h4>
                        <ul className="flex flex-col gap-1">
                          {review.evidence_gaps.map((g, i) => (
                            <li key={i} className="text-xs pl-3" style={{ color: '#555', borderLeft: '2px solid rgba(107,114,128,0.4)' }}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Strengths */}
                    {review.strengths?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#16a34a', opacity: 0.8 }}>잘된 점</h4>
                        <ul className="flex flex-col gap-1">
                          {review.strengths.map((s, i) => (
                            <li key={i} className="text-xs pl-3" style={{ color: '#555', borderLeft: '2px solid rgba(22,163,74,0.4)' }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Improvement prompt */}
                  {!improveDismissed && review.overall_reliability < 95 && (
                    <div className="mx-6 mb-5 rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)' }}>
                      <div className="flex-1">
                        <p className="text-xs font-medium" style={{ color: '#3730a3' }}>
                          현재 합성 신뢰도는 <strong>{review.overall_reliability}</strong>입니다.
                          {' '}AI가 검토 결과를 반영해{' '}
                          <strong>~{Math.min(review.overall_reliability + 10, 97)}</strong>
                          {' '}수준으로 향상시킬 수 있습니다.
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: '#4338ca', opacity: 0.7 }}>
                          잘못된 인용 수정 · 누락 근거 추가 · 근거 없는 주장 제거
                        </p>
                        {improveError && <p className="text-red-500 text-xs mt-1">{improveError}</p>}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={handleImprove}
                          disabled={improveLoading}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                          style={{
                            background: improveLoading ? 'rgba(99,102,241,0.2)' : '#4338ca',
                            color: 'white',
                            cursor: improveLoading ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {improveLoading ? '개선 중...' : '개선하기 →'}
                        </button>
                        <button
                          onClick={() => setImproveDismissed(true)}
                          disabled={improveLoading}
                          className="px-3 py-1.5 rounded-lg text-xs transition-all hover:opacity-70"
                          style={{ background: 'rgba(0,0,0,0.06)', color: '#555', cursor: 'pointer' }}
                        >
                          괜찮아요
                        </button>
                      </div>
                    </div>
                  )}

                  {review.overall_reliability >= 95 && (
                    <div className="mx-6 mb-5 rounded-xl p-3 text-xs text-center" style={{ color: '#16a34a', background: 'rgba(22,163,74,0.06)' }}>
                      신뢰도 {review.overall_reliability}/100 — 추가 개선이 필요하지 않은 수준입니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
