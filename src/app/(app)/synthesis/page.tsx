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
    try {
      const res = await fetch('/api/synthesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesis }),
      })
      const text = await res.text()
      let data: { result?: SynthesisResult; error?: string }
      try { data = JSON.parse(text) } catch { throw new Error('서버 응답 오류') }
      if (!res.ok) throw new Error(data.error || '합성 실패')
      setResult(data.result!)
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
              {/* Export buttons */}
              <div className="flex gap-3 mb-4 no-print">
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
            </div>
          )}
        </main>
      </div>
    </>
  )
}
