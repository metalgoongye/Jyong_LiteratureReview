import type { ExtractionResult } from '@/types/api'
import type { Literature, LiteratureContent, EmpiricalEvidence, SectionType } from '@/types/literature'

export function parseExtractionResponse(rawJson: string): ExtractionResult {
  let parsed: ExtractionResult
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    // Try extracting JSON from markdown code blocks
    const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      parsed = JSON.parse(match[1])
    } else {
      throw new Error('Invalid JSON response from AI')
    }
  }

  // Validate required structure
  if (!parsed.metadata || !parsed.sections || !parsed.quality) {
    throw new Error('Missing required fields in AI response')
  }

  return parsed
}

const VALID_SECTION_TYPES: SectionType[] = [
  'research_question',
  'methodology',
  'findings',
  'conclusion',
  'literature_review',
  'theoretical_framework',
  'data_sources',
  'limitations',
  'other',
]

export function mapToLiteratureUpdate(
  result: ExtractionResult,
  literatureId: string
): Partial<Literature> {
  const { metadata, quality } = result
  return {
    id: literatureId,
    title: metadata.title ?? null,
    authors: metadata.authors?.length ? metadata.authors : null,
    year: metadata.year ?? null,
    journal_name: metadata.journal_name ?? null,
    volume: metadata.volume ?? null,
    issue: metadata.issue ?? null,
    pages: metadata.pages ?? null,
    publisher: metadata.publisher ?? null,
    country: metadata.country ?? null,
    doi: metadata.doi ?? null,
    abstract: metadata.abstract ?? null,
    language: metadata.language ?? 'english',
    fields: metadata.fields?.length ? metadata.fields : ['기타'],
    extraction_status: 'completed',
    extraction_accuracy: quality.overall_accuracy != null
      ? (quality.overall_accuracy <= 1 ? quality.overall_accuracy * 100 : quality.overall_accuracy)
      : null,
    ai_feedback: quality.feedback ?? null,
  }
}

export function mapToContentRows(
  result: ExtractionResult,
  literatureId: string
): Omit<LiteratureContent, 'id' | 'created_at'>[] {
  return result.sections.map((section) => {
    const sectionType = VALID_SECTION_TYPES.includes(section.section_type as SectionType)
      ? (section.section_type as SectionType)
      : 'other'

    return {
      literature_id: literatureId,
      section_type: sectionType,
      section_order: section.section_order ?? 0,
      bullets_original: section.bullets_original?.length ? section.bullets_original : null,
      bullets_korean: section.bullets_korean?.length ? section.bullets_korean : null,
      raw_text_original: null,
      raw_text_korean: null,
      highlight_ranges: null,
    }
  })
}

export function mapToEvidenceRows(
  result: ExtractionResult,
  literatureId: string
): Omit<EmpiricalEvidence, 'id' | 'created_at'>[] {
  return (result.empirical_evidence || []).map((ev, index) => ({
    literature_id: literatureId,
    evidence_text: ev.evidence_text,
    evidence_text_korean: ev.evidence_text_korean ?? null,
    metric_name: ev.metric_name ?? null,
    metric_value: ev.metric_value ?? null,
    metric_unit: ev.metric_unit ?? null,
    page_reference: ev.page_reference ?? null,
    original_quote: ev.original_quote ?? null,
    highlight_ranges: null,
    sort_order: index,
  }))
}
