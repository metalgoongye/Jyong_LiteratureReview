'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { cn } from '@/lib/utils/cn'

interface FileDropzoneProps {
  files: File[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
}

export function FileDropzone({ files, onFilesChange, maxFiles = 10 }: FileDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const merged = [...files, ...acceptedFiles].slice(0, maxFiles)
      onFilesChange(merged)
    },
    [files, onFilesChange, maxFiles]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: maxFiles - files.length,
  })

  function removeFile(index: number) {
    onFilesChange(files.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
          isDragActive
            ? 'border-white/40 bg-white/10'
            : 'border-white/15 hover:border-white/25 hover:bg-white/5'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="opacity-40"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {isDragActive ? (
            <p className="text-sm opacity-70">파일을 여기에 놓으세요</p>
          ) : (
            <>
              <p className="text-sm opacity-60">PDF 파일을 드래그하거나 클릭해서 선택</p>
              <p className="text-xs opacity-40">최대 {maxFiles}개 파일, 각 20MB 이하</p>
            </>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-shrink-0 opacity-50"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                </svg>
                <span className="text-xs opacity-70 truncate">{file.name}</span>
                <span className="text-xs opacity-30 flex-shrink-0">
                  {(file.size / 1024 / 1024).toFixed(1)}MB
                </span>
              </div>
              <button
                onClick={() => removeFile(i)}
                className="text-xs opacity-30 hover:opacity-70 ml-2 flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
