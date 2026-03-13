'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Spinner } from '@/components/ui/Spinner'

interface PdfViewerWrapperProps {
  storagePath: string
  literatureId: string
}

export function PdfViewerWrapper({ storagePath, literatureId }: PdfViewerWrapperProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    async function fetchSignedUrl() {
      try {
        const res = await fetch(`/api/pdf-url?storagePath=${encodeURIComponent(storagePath)}`)
        if (!res.ok) throw new Error('Failed to get PDF URL')
        const data = await res.json()
        setPdfUrl(data.url)
      } catch (err) {
        setError('PDF를 불러오지 못했습니다.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchSignedUrl()
  }, [storagePath])

  const handlePageSelect = useCallback((e: Event) => {
    const page = (e as CustomEvent<{ page: number }>).detail.page
    if (iframeRef.current && pdfUrl) {
      // Navigate iframe to the specific page using URL fragment
      iframeRef.current.src = `${pdfUrl}#page=${page}&toolbar=1`
    }
  }, [pdfUrl])

  useEffect(() => {
    window.addEventListener('pdf-page-select', handlePageSelect)
    return () => window.removeEventListener('pdf-page-select', handlePageSelect)
  }, [handlePageSelect])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full opacity-40">
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      src={pdfUrl ? `${pdfUrl}#toolbar=1` : undefined}
      className="w-full h-full"
      title="PDF Viewer"
      style={{ minHeight: '600px' }}
    />
  )
}
