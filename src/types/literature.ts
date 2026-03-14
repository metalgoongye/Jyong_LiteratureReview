export type UploadSourceType = 'pdf' | 'url' | 'image'
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type PaperLanguage = 'korean' | 'english' | 'other'

export const RESEARCH_FIELDS = [
  '토지이용계획',
  '주택정책 및 부동산',
  '환경계획',
  '탄소중립',
  '기후변화적응 및 재난안전관리',
  'GeoAI',
  '도시계획 일반',
  '교통계획',
  '기타',
] as const

export type ResearchField = (typeof RESEARCH_FIELDS)[number]

export interface BulletPoint {
  text: string
  page_ref?: string | null
}

export interface HighlightRange {
  page: number
  start_offset: number
  end_offset: number
  quote?: string
}

export interface Literature {
  id: string
  user_id: string
  source_type: UploadSourceType
  source_url?: string | null
  storage_path?: string | null
  original_filename?: string | null
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
  language: PaperLanguage
  fields?: string[] | null
  extraction_status: ExtractionStatus
  extraction_accuracy?: number | null
  ai_feedback?: string | null
  six_is_scores?: {
    accurate: number; accurate_reason?: string
    precise: number; precise_reason?: string
    consistent: number; consistent_reason?: string
    coherent: number; coherent_reason?: string
    average: number
    overall: number; overall_reason?: string
    base_total: number
    grade: string
    verified_at: string
  } | null
  accuracy_details?: {
    abstract_alignment?: number | null
    field_completeness: number
    overall: number
    verified_at: string
  } | null
  user_notes?: string | null
  ai_model_used?: string | null
  extraction_prompt_id?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  causal_paths?: Array<{
    model_name: string
    nodes: Array<{ id: string; label: string; type: 'independent' | 'mediator' | 'dependent' }>
    edges: Array<{ from: string; to: string; coefficient?: string | null; pvalue?: string | null; direction?: '+' | '-' | null }>
    methodology?: { method_name?: string | null; analysis_type?: string | null; table_reference?: string | null; page_reference?: string | null } | null
  }> | null
}

export interface LiteratureContent {
  id: string
  literature_id: string
  section_type: SectionType
  section_order: number
  bullets_original?: BulletPoint[] | null
  bullets_korean?: BulletPoint[] | null
  raw_text_original?: string | null
  raw_text_korean?: string | null
  highlight_ranges?: HighlightRange[] | null
  created_at: string
}

export type SectionType =
  | 'research_question'
  | 'methodology'
  | 'findings'
  | 'conclusion'
  | 'literature_review'
  | 'theoretical_framework'
  | 'data_sources'
  | 'limitations'
  | 'other'

export const SECTION_LABELS: Record<SectionType, string> = {
  research_question: '연구 질문',
  methodology: '연구 방법',
  findings: '연구 결과',
  conclusion: '결론',
  literature_review: '선행연구',
  theoretical_framework: '이론적 틀',
  data_sources: '데이터',
  limitations: '한계',
  other: '기타',
}

export interface EmpiricalEvidence {
  id: string
  literature_id: string
  evidence_text: string
  evidence_text_korean?: string | null
  metric_name?: string | null
  metric_value?: string | null
  metric_unit?: string | null
  page_reference?: string | null
  original_quote?: string | null
  highlight_ranges?: HighlightRange[] | null
  sort_order: number
  created_at: string
}

export interface AiPrompt {
  id: string
  user_id: string
  name: string
  description?: string | null
  is_default: boolean
  is_system: boolean
  system_prompt: string
  user_prompt_template: string
  model: string
  temperature: number
  max_tokens: number
  created_at: string
  updated_at: string
}

export interface BatchJob {
  id: string
  user_id: string
  total_files: number
  completed_files: number
  failed_files: number
  overall_status: ExtractionStatus
  overall_accuracy?: number | null
  started_at?: string | null
  completed_at?: string | null
  created_at: string
}

export interface LiteratureWithContent extends Literature {
  content?: LiteratureContent[]
  evidence?: EmpiricalEvidence[]
}
