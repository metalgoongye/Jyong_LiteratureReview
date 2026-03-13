'use client'

import { useState } from 'react'

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

export default function SynthesisPage() {
  const [hypothesis, setHypothesis] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SynthesisResult | null>(null)

  async function handleSynthesize() {
    if (!hypothesis.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  function exportPDF() {
    window.print()
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
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-area { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="p-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 no-print">
          <h1 className="text-2xl font-semibold">Synthesis</h1>
          <p className="text-sm opacity-50 mt-0.5">가설 기반 근거 합성 — Evidence-backed Research Proposal</p>
        </div>

        {/* Input */}
        <div className="glass-card p-6 mb-6 no-print">
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
          <div>
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
      </div>
    </>
  )
}
