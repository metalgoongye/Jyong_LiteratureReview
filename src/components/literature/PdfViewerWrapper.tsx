'use client'

import { useState, useEffect } from 'react'
import { Spinner } from '@/components/ui/Spinner'

interface PdfViewerWrapperProps {
  storagePath: string
  literatureId: string
}

export function PdfViewerWrapper({ storagePath, literatureId }: PdfViewerWrapperProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      src={`${pdfUrl}#toolbar=1`}
      className="w-full h-full"
      title="PDF Viewer"
      style={{ minHeight: '600px' }}
    />
  )
}
