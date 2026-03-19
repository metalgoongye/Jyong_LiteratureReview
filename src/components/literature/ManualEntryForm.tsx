'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DOC_TYPES = [
  { value: 'journal',      label: '학술논문' },
  { value: 'book',         label: '단행본' },
  { value: 'book_chapter', label: '책 챕터' },
  { value: 'thesis',       label: '학위논문' },
  { value: 'report',       label: '보고서' },
  { value: 'news',         label: '뉴스/기사' },
  { value: 'webpage',      label: '웹페이지/블로그' },
  { value: 'conference',   label: '학회 발표' },
  { value: 'other',        label: '기타' },
]

type FieldDef = { name: string; label: string; placeholder: string }
type RowDef = FieldDef[]

const TYPE_FIELDS: Record<string, RowDef[]> = {
  journal: [
    [
      { name: 'journal_name', label: '학술지',    placeholder: 'Journal of Urban Planning' },
      { name: 'year',         label: '출판 연도', placeholder: '2024' },
    ],
    [
      { name: 'volume', label: '권 (Vol)',   placeholder: '12' },
      { name: 'issue',  label: '호 (Issue)', placeholder: '3' },
      { name: 'pages',  label: '페이지',     placeholder: '123-145' },
    ],
    [
      { name: 'publisher', label: '출판사', placeholder: 'Elsevier' },
      { name: 'country',   label: '국가',   placeholder: 'USA' },
    ],
    [{ name: 'doi', label: 'DOI', placeholder: '10.1016/j.xxx.2024.000000' }],
  ],
  book: [
    [
      { name: 'publisher', label: '출판사',   placeholder: 'Springer' },
      { name: 'year',      label: '출판 연도', placeholder: '2024' },
    ],
    [
      { name: 'volume',  label: '판 (Edition)', placeholder: '3rd' },
      { name: 'pages',   label: '총 페이지',   placeholder: '350' },
      { name: 'country', label: '출판 국가',   placeholder: 'USA' },
    ],
    [{ name: 'doi', label: 'ISBN', placeholder: '978-3-16-148410-0' }],
  ],
  book_chapter: [
    [
      { name: 'journal_name', label: '수록 책 제목', placeholder: '책 전체 제목' },
      { name: 'year',         label: '출판 연도',   placeholder: '2024' },
    ],
    [
      { name: 'publisher', label: '출판사',      placeholder: 'Springer' },
      { name: 'pages',     label: '챕터 페이지', placeholder: '45-78' },
    ],
    [{ name: 'doi', label: 'ISBN', placeholder: '978-3-16-148410-0' }],
  ],
  thesis: [
    [
      { name: 'journal_name', label: '대학교',    placeholder: '서울대학교' },
      { name: 'year',         label: '졸업 연도', placeholder: '2024' },
    ],
    [
      { name: 'publisher', label: '학과/전공', placeholder: '도시계획학과' },
      { name: 'volume',    label: '학위 구분', placeholder: '박사 / 석사' },
      { name: 'pages',     label: '총 페이지', placeholder: '200' },
    ],
  ],
  report: [
    [
      { name: 'journal_name', label: '발행 기관', placeholder: '국토연구원' },
      { name: 'year',         label: '발행 연도', placeholder: '2024' },
    ],
    [
      { name: 'publisher', label: '보고서 번호', placeholder: 'WP 2024-05' },
      { name: 'country',   label: '국가',        placeholder: '한국' },
    ],
  ],
  news: [
    [
      { name: 'journal_name', label: '매체명',   placeholder: '한겨레, The New York Times' },
      { name: 'year',         label: '발행 연도', placeholder: '2024' },
    ],
    [{ name: 'pages', label: '섹션', placeholder: '경제, 사회' }],
  ],
  webpage: [
    [
      { name: 'journal_name', label: '사이트/블로그명', placeholder: 'Medium, 브런치' },
      { name: 'year',         label: '작성 연도',      placeholder: '2024' },
    ],
    [{ name: 'publisher', label: '접속일', placeholder: '2024-03-19' }],
  ],
  conference: [
    [
      { name: 'journal_name', label: '학회/컨퍼런스명', placeholder: 'ACSP 2024' },
      { name: 'year',         label: '개최 연도',      placeholder: '2024' },
    ],
    [
      { name: 'country', label: '개최 국가/도시', placeholder: 'Chicago, USA' },
      { name: 'pages',   label: '페이지',         placeholder: '123-130' },
    ],
  ],
  other: [
    [
      { name: 'journal_name', label: '학술지/매체/기관명', placeholder: '출처명' },
      { name: 'year',         label: '연도',             placeholder: '2024' },
    ],
    [
      { name: 'volume', label: '권/판',  placeholder: '12' },
      { name: 'issue',  label: '호',     placeholder: '3' },
      { name: 'pages',  label: '페이지', placeholder: '123-145' },
    ],
    [
      { name: 'publisher', label: '출판사/기관', placeholder: 'Elsevier' },
      { name: 'country',   label: '국가',        placeholder: 'USA' },
    ],
    [{ name: 'doi', label: 'DOI / ISBN', placeholder: '10.1016/...' }],
  ],
}

export function ManualEntryForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [docType, setDocType] = useState('journal')
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
  const [isDragging, setIsDragging] = useState(false)
  const [runAi, setRunAi] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleTypeChange(type: string) {
    setDocType(type)
    setForm((prev) => ({
      ...prev,
      year: '',
      journal_name: '',
      volume: '',
      issue: '',
      pages: '',
      publisher: '',
      country: '',
      doi: '',
    }))
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

      const authors = form.authors.split(/[,;，]+/).map((a) => a.trim()).filter(Boolean)
      const fields = form.fields.split(/[,，]+/).map((f) => f.trim()).filter(Boolean)

      const res = await fetch('/api/literature/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          doc_type: docType,
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

  const typeRows = TYPE_FIELDS[docType] ?? TYPE_FIELDS.other

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* 문헌 유형 선택 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-2">문헌 유형</label>
        <div className="flex flex-wrap gap-2">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: docType === t.value ? '#111' : 'rgba(0,0,0,0.05)',
                color: docType === t.value ? 'white' : '#555',
                border: docType === t.value ? '1px solid #111' : '1px solid rgba(0,0,0,0.08)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 파일 업로드 (드래그앤드롭 + 클릭) */}
      <div
        className="rounded-xl flex flex-col gap-2 transition-all cursor-pointer"
        style={{
          background: isDragging ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.03)',
          border: isDragging ? '2px dashed rgba(0,0,0,0.3)' : '2px dashed rgba(0,0,0,0.12)',
          padding: isDragging ? '20px 16px' : '16px',
        }}
        onClick={() => !pdfFile && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) setPdfFile(f)
        }}
      >
        <p className="text-xs font-medium opacity-50">파일 첨부 (선택) — PDF, 사진(JPG·HEIC·PNG) 가능</p>
        {pdfFile ? (
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40 flex-shrink-0">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm flex-1 truncate">{pdfFile.name}</span>
            <button type="button" onClick={() => setPdfFile(null)} className="text-xs opacity-40 hover:opacity-70 flex-shrink-0">제거</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm opacity-40">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            드래그하거나 클릭해서 파일 선택
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdfFile(f) }}
        />
        {pdfFile && (
          <label className="flex items-center gap-2 mt-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
              style={{ background: runAi ? '#111' : 'rgba(0,0,0,0.12)' }}
              onClick={() => setRunAi((v) => !v)}
            >
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: runAi ? '20px' : '2px' }} />
            </div>
            <span className="text-xs opacity-60">AI 분석 실행</span>
          </label>
        )}
      </div>

      {/* 제목 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">제목 <span className="text-red-400">*</span></label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="제목"
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* 저자 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">저자/작성자 (쉼표로 구분)</label>
        <input
          name="authors"
          value={form.authors}
          onChange={handleChange}
          placeholder="홍길동, Kim J., Smith A."
          className={inputClass}
          style={inputStyle}
        />
      </div>

      {/* 유형별 동적 필드 */}
      {typeRows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${row.length}, 1fr)` }}
        >
          {row.map((field) => (
            <div key={field.name}>
              <label className="block text-xs font-medium opacity-50 mb-1">{field.label}</label>
              <input
                name={field.name}
                value={form[field.name as keyof typeof form] as string}
                onChange={handleChange}
                placeholder={field.placeholder}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      ))}

      {/* URL */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">URL</label>
        <input name="source_url" value={form.source_url} onChange={handleChange} placeholder="https://..." className={inputClass} style={inputStyle} />
      </div>

      {/* 언어 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">언어</label>
        <select name="language" value={form.language} onChange={handleChange} className={inputClass} style={inputStyle}>
          <option value="english">영어</option>
          <option value="korean">한국어</option>
          <option value="other">기타</option>
        </select>
      </div>

      {/* 분야 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">분야 (쉼표로 구분)</label>
        <input name="fields" value={form.fields} onChange={handleChange} placeholder="토지이용계획, 환경계획" className={inputClass} style={inputStyle} />
      </div>

      {/* 초록 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">초록 / 요약</label>
        <textarea
          name="abstract"
          value={form.abstract}
          onChange={handleChange}
          placeholder="초록 또는 요약..."
          rows={4}
          className={`${inputClass} resize-none`}
          style={inputStyle}
        />
      </div>

      {/* 개인 메모 */}
      <div>
        <label className="block text-xs font-medium opacity-50 mb-1">개인 메모</label>
        <textarea
          name="user_notes"
          value={form.user_notes}
          onChange={handleChange}
          placeholder="메모..."
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
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-xl text-sm opacity-40 hover:opacity-70 transition-opacity">
          취소
        </button>
      </div>
    </form>
  )
}
