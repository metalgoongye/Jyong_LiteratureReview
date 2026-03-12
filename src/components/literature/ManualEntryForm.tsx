'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ManualEntryForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    authors: '',
    year: '',
    journal_name: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    country: '',
    doi: '',
    abstract: '',
    language: 'english' as 'korean' | 'english' | 'other',
    fields: '',
    source_url: '',
    user_notes: '',
  })
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [runAi, setRunAi] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('제목은 필수 항목입니다.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      let storage_path: string | null = null
      let original_filename: string | null = null

      // Upload PDF if provided
      if (pdfFile) {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('로그인이 필요합니다.')
        const ext = pdfFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('literature-files')
          .upload(path, pdfFile)
        if (uploadError) throw new Error(`파일 업로드 실패: ${uploadError.message}`)
        storage_path = path
        original_filename = pdfFile.name
      }

      const authors = form.authors
        .split(/[,;，]+/)
        .map((a) => a.trim())
        .filter(Boolean)

      const fields = form.fields
        .split(/[,，]+/)
        .map((f) => f.trim())
        .filter(Boolean)

      const res = await fetch('/api/literature/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          authors,
          fields,
          year: form.year ? parseInt(form.year) : null,
          storage_path,
          original_filename,
          run_ai: runAi && !!storage_path,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '저장 실패')

      router.push(`/literature/${data.literatureId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full text-sm px-3 py-2 rounded-lg outline-none transition-all'
  const inputStyle = {
    background: 'rgba(0,0,0,0.04)',
    border: '1px solid rgba(0,0,0,0.08)',
    color: '#111',
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* PDF Upload */}
      <div
        className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: 'rgba(0,0,0,0.03)', border: '1px dashed rgba(0,0,0,0.12)' }}
      >
        <p className="text-xs font-medium opacity-50">PDF 파일 (선택)</p>
        {pdfFile ? (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm flex-1 truncate">{pdfFile.name}</span>
            <button
              type="button"
              onClick={() => setPdfFile(null)}
              className="text-xs opacity-40 hover:opacity-70"
            >
              제거
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm opacity-50 hover:opacity-80 text-left"
          >
            + PDF 파일 선택
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setPdfFile(f)
          }}
        />

        {pdfFile && (
          <label className="flex items-center gap-2 mt-1 cursor-pointer">
            <div
              className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
              style={{ background: runAi ? '#111' : 'rgba(0,0,0,0.12)' }}
              onClick={() => setRunAi((v) => !v)}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: runAi ? '20px' : '2px' }}
              />
            </div>
            <span className="text-xs opacity-60">AI 분석 실행</span>
          </label>
        )}
      </div>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">제목 <span className="text-red-400">*</span></label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="논문 제목"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Authors */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">저자 (쉼표로 구분)</label>
        <input
          name="authors"
          value={form.authors}
          onChange={handleChange}
          placeholder="홍길동, Kim J., Smith A."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Year + Journal */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">출판 연도</label>
          <input
            name="year"
            value={form.year}
            onChange={handleChange}
            placeholder="2024"
            type="number"
            min="1900"
            max="2100"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">학술지</label>
          <input
            name="journal_name"
            value={form.journal_name}
            onChange={handleChange}
            placeholder="Journal of Urban Planning"
            className={inputClass}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Volume + Issue + Pages */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">권 (Vol)</label>
          <input name="volume" value={form.volume} onChange={handleChange} placeholder="12" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">호 (Issue)</label>
          <input name="issue" value={form.issue} onChange={handleChange} placeholder="3" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">페이지</label>
          <input name="pages" value={form.pages} onChange={handleChange} placeholder="123-145" className={inputClass} style={inputStyle} />
        </div>
      </div>

      {/* Publisher + Country */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">출판사</label>
          <input name="publisher" value={form.publisher} onChange={handleChange} placeholder="Elsevier" className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium opacity-50 mb-1">국가</label>
          <input name="country" value={form.country} onChange={handleChange} placeholder="USA" className={inputClass} style={inputStyle} />
        </div>
      </div>

      {/* DOI + Source URL */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">DOI</label>
        <input name="doi" value={form.doi} onChange={handleChange} placeholder="10.1016/j.xxx.2024.000000" className={inputClass} style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">URL (논문 링크)</label>
        <input name="source_url" value={form.source_url} onChange={handleChange} placeholder="https://..." className={inputClass} style={inputStyle} />
      </div>

      {/* Language */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">언어</label>
        <select name="language" value={form.language} onChange={handleChange} className={inputClass} style={inputStyle}>
          <option value="english">영어</option>
          <option value="korean">한국어</option>
          <option value="other">기타</option>
        </select>
      </div>

      {/* Fields */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">분야 (쉼표로 구분)</label>
        <input
          name="fields"
          value={form.fields}
          onChange={handleChange}
          placeholder="토지이용계획, 환경계획"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* Abstract */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">초록 (Abstract)</label>
        <textarea
          name="abstract"
          value={form.abstract}
          onChange={handleChange}
          placeholder="논문 초록..."
          rows={4}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      {/* User notes */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">개인 메모</label>
        <textarea
          name="user_notes"
          value={form.user_notes}
          onChange={handleChange}
          placeholder="이 논문에 대한 메모..."
          rows={3}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: submitting ? 'rgba(0,0,0,0.08)' : '#111',
            color: submitting ? '#999' : 'white',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '저장 중...' : '저장하기 →'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm opacity-40 hover:opacity-70 transition-opacity"
        >
          취소
        </button>
      </div>
    </form>
  )
}
