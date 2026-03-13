'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileDropzone } from '@/components/upload/FileDropzone'
import { BatchProgress } from '@/components/upload/BatchProgress'

type Tab = 'pdf' | 'url' | 'image'

const sharedStyles = `
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes heartbeat {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(100,100,100,0.2); }
    50% { transform: scale(1.03); box-shadow: 0 0 0 8px rgba(100,100,100,0); }
  }
  .light-card {
    background: rgba(255,255,255,0.65);
    backdrop-filter: blur(28px);
    -webkit-backdrop-filter: blur(28px);
    border: 1px solid rgba(255,255,255,0.8);
    border-radius: 20px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.07);
  }
`

export default function UploadPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('pdf')
  const [files, setFiles] = useState<File[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadResult, setUploadResult] = useState<{
    literatureIds: string[]
    batchJobId: string
  } | null>(null)
  const [allDone, setAllDone] = useState(false)

  async function handleExtractAll(literatureIds: string[]) {
    for (const id of literatureIds) {
      fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ literatureId: id }),
      }).catch(console.error)
    }
  }

  async function handleUpload() {
    setLoading(true)
    setError('')

    try {
      let result: { literatureIds: string[]; batchJobId: string }

      if (tab === 'url') {
        if (!url.trim()) { setError('URL을 입력해주세요.'); setLoading(false); return }
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error)
        }
        result = await res.json()
      } else {
        const uploadFiles = tab === 'pdf' ? files : imageFiles
        if (uploadFiles.length === 0) {
          setError('파일을 선택해주세요.')
          setLoading(false)
          return
        }
        const allLiteratureIds: string[] = []
        let firstBatchJobId = ''
        for (const file of uploadFiles) {
          const formData = new FormData()
          formData.append('files', file)
          const res = await fetch('/api/upload', { method: 'POST', body: formData })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error)
          }
          const data = await res.json()
          allLiteratureIds.push(...data.literatureIds)
          if (!firstBatchJobId) firstBatchJobId = data.batchJobId
        }
        result = { literatureIds: allLiteratureIds, batchJobId: firstBatchJobId }
      }

      setUploadResult(result)
      await handleExtractAll(result.literatureIds)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (uploadResult) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <style>{sharedStyles}</style>
        <div className="w-full max-w-lg">
          <div className="light-card p-8">
            <h2 className="text-gray-900 text-lg font-semibold mb-1">
              {allDone ? '분석 완료!' : 'AI 분석 중...'}
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              {allDone ? '문헌 목록에서 결과를 확인하세요.' : '업로드한 문헌에서 핵심 내용을 추출하고 있습니다.'}
            </p>
            <BatchProgress
              literatureIds={uploadResult.literatureIds}
              batchJobId={uploadResult.batchJobId}
              onComplete={() => {
                setAllDone(true)
                setTimeout(() => router.push('/literature'), 3000)
              }}
            />
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push('/literature')}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #1a1a1a, #444, #1a1a1a)',
                  backgroundSize: '200% 200%',
                  animation: allDone ? 'gradientShift 3s ease infinite, heartbeat 1.8s ease-in-out infinite' : 'none',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                문헌 목록으로
              </button>
              <button
                onClick={() => {
                  setUploadResult(null)
                  setFiles([])
                  setImageFiles([])
                  setUrl('')
                }}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  color: '#333',
                  border: '1px solid rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                }}
              >
                더 업로드
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <style>{sharedStyles}</style>
      <div className="w-full max-w-lg">
        <div className="light-card p-6">
          {/* Tab switcher */}
          <div
            className="flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: 'rgba(0,0,0,0.06)' }}
          >
            {(['pdf', 'url', 'image'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: tab === t ? 'rgba(0,0,0,0.1)' : 'transparent',
                  color: tab === t ? '#111' : 'rgba(0,0,0,0.4)',
                }}
              >
                {t === 'pdf' ? 'PDF' : t === 'url' ? 'URL' : '이미지'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'pdf' && (
            <FileDropzone files={files} onFilesChange={setFiles} />
          )}

          {tab === 'url' && (
            <div className="flex flex-col gap-3">
              <input
                type="url"
                placeholder="https://doi.org/... 또는 논문 URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                style={{
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              <p className="text-xs text-gray-400">
                DOI, arXiv, ResearchGate, 학술지 URL 등 지원
              </p>
            </div>
          )}

          {tab === 'image' && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => document.getElementById('image-input')?.click()}
                className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all"
                style={{ borderColor: 'rgba(0,0,0,0.12)' }}
              >
                <input
                  id="image-input"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || [])
                    setImageFiles((prev) => [...prev, ...newFiles].slice(0, 10))
                  }}
                />
                <p className="text-sm text-gray-500">JPG, PNG 이미지 선택</p>
                <p className="text-xs mt-1 text-gray-400">논문 스캔본, 캡처 이미지 지원</p>
              </div>
              {imageFiles.length > 0 && (
                <div className="flex flex-col gap-1">
                  {imageFiles.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-xs text-gray-500">
                      <span>{f.name}</span>
                      <button
                        onClick={() => setImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          )}

          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full mt-5 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: loading ? 'rgba(0,0,0,0.08)' : '#111',
              color: loading ? '#999' : 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              animation: loading ? 'none' : 'heartbeat 2s ease-in-out infinite',
            }}
          >
            {loading ? '업로드 중...' : '분석 시작 →'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          PDF 최대 10개 · 각 파일 20MB 이하 · 이미지 JPG/PNG 지원
        </p>
      </div>
    </div>
  )
}
