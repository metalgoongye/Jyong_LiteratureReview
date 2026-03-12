import type { LiteratureWithContent, BatchJob } from './literature'

export interface UploadRequest {
  files?: File[]
  url?: string
}

export interface UploadResponse {
  literatureIds: string[]
  batchJobId: string
}

export interface ExtractRequest {
  literatureId: string
  promptId?: string
}

export interface ExtractResponse {
  success: boolean
  literature: LiteratureWithContent
}

export interface BatchStatusResponse {
  batchJob: BatchJob
  literatureItems: LiteratureWithContent[]
}

export interface ApiError {
  error: string
  details?: string
}

// OpenRouter response shape
export interface ExtractionResult {
  metadata: {
    title?: string | null
    title_korean?: string | null
    authors?: string[]
    year?: number | null
    journal_name?: string | null
    volume?: string | null
    issue?: string | null
    pages?: string | null
    publisher?: string | null
    country?: string | null
    doi?: string | null
    abstract?: string | null
    abstract_korean?: string | null
    language?: 'korean' | 'english' | 'other'
    fields?: string[]
  }
  sections: Array<{
    section_type: string
    section_order: number
    bullets_original?: Array<{ text: string; page_ref?: string | null }>
    bullets_korean?: Array<{ text: string; page_ref?: string | null }>
  }>
  empirical_evidence: Array<{
    evidence_text: string
    evidence_text_korean?: string | null
    metric_name?: string | null
    metric_value?: string | null
    metric_unit?: string | null
    page_reference?: string | null
    original_quote?: string | null
  }>
  quality: {
    overall_accuracy: number
    metadata_confidence: number
    content_confidence: number
    feedback: string
  }
  causal_paths?: {
    nodes: Array<{ id: string; label: string; type: 'independent' | 'mediator' | 'dependent' }>
    edges: Array<{ from: string; to: string; coefficient?: string | null; pvalue?: string | null; direction?: '+' | '-' | null }>
  } | null
}
