'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Literature {
  id: string
  title?: string | null
  authors?: string[] | null
  year?: number | null
  journal_name?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  publisher?: string | null
  country?: string | null
  doi?: string | null
  abstract?: string | null
  language?: string | null
  doc_type?: string | null
  storage_path?: string | null
  original_filename?: string | null
}

const DOC_TYPES = [
  { value: 'journal', label: '학술논문' },
  { value: 'book', label: '단행본' },
  { value: 'book_chapter', label: '책 챕터' },
  { value: 'thesis', label: '학위논문' },
  { value: 'report', label: '보고서' },
  { value: 'news', label: '뉴스/기사' },
  { value: 'webpage', label: '웹페이지/블로그' },
  { value: 'conference', label: '학회 발표' },
  { value: 'other', label: '기타' },
]

export function EditButton({ literature }: { literature: Literature }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [newFile, setNewFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: literature.title ?? '',
    authors: (literature.authors ?? []).join(', '),
    year: literature.year?.toString() ?? '',
    journal_name: literature.journal_name ?? '',
    volume: literature.volume ?? '',
    issue: literature.issue ?? '',
    pages: literature.pages ?? '',
    publisher: literature.publisher ?? '',
    country: literature.country ?? '',
    doi: literature.doi ?? '',
    abstract: literature.abstract ?? '',
    language: literature.language ?? 'english',
    doc_type: literature.doc_type ?? 'journal',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleFile(f: File) {
    setNewFile(f)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // 1. Update metadata
      const authorsArr = form.authors
        .split(',')
        .map(a => a.trim())
        .filter(Boolean)

      const res = await fetch(`/api/literature/${literature.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || null,
          authors: authorsArr,
          year: form.year ? parseInt(form.year) : null,
          journal_name: form.journal_name || null,
          volume: form.volume || null,
          issue: form.issue || null,
          pages: form.pages || null,
          publisher: form.publisher || null,
          country: form.country || null,
          doi: form.doi || null,
          abstract: form.abstract || null,
          language: form.language || 'english',
          doc_type: form.doc_type || 'journal',
        }),
      })
      if (!res.ok) throw new Error('저장 실패')

      // 2. Upload new file if selected
      if (newFile) {
        const fd = new FormData()
        fd.append('file', newFile)
        const uploadRes = await fetch(`/api/literature/${literature.id}/upload`, {
          method: 'POST',
          body: fd,
        })
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}))
          throw new Error(errData.error || '파일 업로드 실패')
        }
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2.5 py-1 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.06)', cursor: 'pointer' }}
      >
        수정
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
        onClick={() => !saving && setOpen(false)}
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 flex flex-col gap-4"
          style={{ background: 'var(--color-surface, #fff)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">문헌 수정</h2>
            <button
              onClick={() => setOpen(false)}
              className="opacity-40 hover:opacity-70 transition-opacity"
              style={{ cursor: 'pointer', background: 'none', border: 'none', padding: '4px' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Doc type */}
          <div className="flex flex-wrap gap-1.5">
            {DOC_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => set('doc_type', t.value)}
                className="text-xs px-2.5 py-1 rounded-lg transition-all"
                style={{
                  background: form.doc_type === t.value ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.05)',
                  color: form.doc_type === t.value ? '#4338ca' : undefined,
                  fontWeight: form.doc_type === t.value ? 600 : undefined,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-50">제목</label>
              <input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="제목"
                className="glass-input w-full text-sm px-3 py-2 rounded-lg"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-50">저자 (쉼표로 구분)</label>
              <input
                value={form.authors}
                onChange={e => set('authors', e.target.value)}
                placeholder="홍길동, 김철수"
                className="glass-input w-full text-sm px-3 py-2 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">연도</label>
                <input
                  value={form.year}
                  onChange={e => set('year', e.target.value)}
                  placeholder="2024"
                  type="number"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">언어</label>
                <select
                  value={form.language}
                  onChange={e => set('language', e.target.value)}
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                >
                  <option value="english">English</option>
                  <option value="korean">한국어</option>
                  <option value="other">기타</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-50">저널/출판사/출처</label>
              <input
                value={form.journal_name}
                onChange={e => set('journal_name', e.target.value)}
                placeholder="저널명 또는 출판사"
                className="glass-input w-full text-sm px-3 py-2 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">권(Volume)</label>
                <input
                  value={form.volume}
                  onChange={e => set('volume', e.target.value)}
                  placeholder="10"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">호(Issue)</label>
                <input
                  value={form.issue}
                  onChange={e => set('issue', e.target.value)}
                  placeholder="3"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">페이지</label>
                <input
                  value={form.pages}
                  onChange={e => set('pages', e.target.value)}
                  placeholder="12-34"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">출판사</label>
                <input
                  value={form.publisher}
                  onChange={e => set('publisher', e.target.value)}
                  placeholder="Publisher"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50">국가</label>
                <input
                  value={form.country}
                  onChange={e => set('country', e.target.value)}
                  placeholder="Korea"
                  className="glass-input w-full text-sm px-3 py-2 rounded-lg"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-50">DOI</label>
              <input
                value={form.doi}
                onChange={e => set('doi', e.target.value)}
                placeholder="10.xxxx/..."
                className="glass-input w-full text-sm px-3 py-2 rounded-lg"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs opacity-50">초록</label>
              <textarea
                value={form.abstract}
                onChange={e => set('abstract', e.target.value)}
                placeholder="초록을 입력하세요"
                rows={3}
                className="glass-input w-full text-sm px-3 py-2 rounded-lg resize-none"
              />
            </div>
          </div>

          {/* PDF Upload */}
          <div className="flex flex-col gap-1">
            <label className="text-xs opacity-50">
              PDF 파일 {literature.storage_path ? '(교체)' : '(추가)'}
            </label>
            <div
              className="relative rounded-xl border-2 border-dashed transition-all text-center py-5 px-4"
              style={{
                borderColor: isDragging ? 'rgba(99,102,241,0.6)' : 'rgba(0,0,0,0.12)',
                background: isDragging ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.02)',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault()
                setIsDragging(false)
                const f = e.dataTransfer.files?.[0]
                if (f) handleFile(f)
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
              {newFile ? (
                <p className="text-sm font-medium">{newFile.name}</p>
              ) : literature.original_filename ? (
                <p className="text-sm opacity-40">현재: {literature.original_filename}<br /><span className="text-xs">클릭하거나 드래그해서 교체</span></p>
              ) : (
                <p className="text-sm opacity-40">클릭하거나 드래그해서 파일 추가<br /><span className="text-xs">PDF · JPG · PNG · HEIC</span></p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setOpen(false)}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.06)', cursor: 'pointer', border: 'none' }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 rounded-lg transition-opacity"
              style={{ background: '#111', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, border: 'none' }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
