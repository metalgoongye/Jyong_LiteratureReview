import type { ExtractionResult } from '@/types/api'
import type { Literature, LiteratureContent, EmpiricalEvidence, SectionType } from '@/types/literature'

function repairTruncatedJson(raw: string): string {
  // Strip markdown fences if present
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  let s = fenceMatch ? fenceMatch[1] : raw

  // Find the outermost opening brace
  const start = s.indexOf('{')
  if (start === -1) throw new Error('No JSON object found')
  s = s.slice(start)

  // Walk through and track open structures
  let depth = 0
  let inString = false
  let escape = false
  let lastCompleteDepthZero = -1

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0) lastCompleteDepthZero = i
    }
  }

  if (depth === 0 && lastCompleteDepthZero === s.length - 1) return s // already valid

  // Truncated: close open structures
  const closers: string[] = []
  let d = 0
  let ins = false
  let esc = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (esc) { esc = false; continue }
    if (ch === '\\' && ins) { esc = true; continue }
    if (ch === '"') { ins = !ins; continue }
    if (ins) continue
    if (ch === '{') { d++; closers.push('}') }
    else if (ch === '[') { d++; closers.push(']') }
    else if (ch === '}' || ch === ']') { d--; closers.pop() }
  }

  // Trim trailing incomplete token (comma, colon, partial string)
  let trimmed = s.trimEnd()
  while (trimmed.endsWith(',') || trimmed.endsWith(':')) {
    trimmed = trimmed.slice(0, -1).trimEnd()
  }
  // Close unclosed string
  if (ins) trimmed += '"'

  return trimmed + closers.reverse().join('')
}

export function parseExtractionResponse(rawJson: string): ExtractionResult {
  let parsed: ExtractionResult
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    // Try extracting JSON from markdown code blocks
    const fenceMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) {
      try {
        parsed = JSON.parse(fenceMatch[1])
      } catch {
        parsed = JSON.parse(repairTruncatedJson(fenceMatch[1]))
      }
    } else {
      // Try repairing truncated JSON
      try {
        parsed = JSON.parse(repairTruncatedJson(rawJson))
      } catch {
        throw new Error('Invalid JSON response from AI')
      }
    }
  }

  // Validate required structure
  if (!parsed.metadata || !parsed.sections || !parsed.quality) {
    throw new Error('Missing required fields in AI response')
  }

  return parsed
}

const VALID_SECTION_TYPES: SectionType[] = [
  'research_background',
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
    causal_paths: result.causal_paths ?? null,
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
  const hasNumber = (s: string | null | undefined) => s != null && /\d/.test(s)

  return (result.empirical_evidence || [])
    .filter((ev) => hasNumber(ev.metric_value) || hasNumber(ev.evidence_text))
    .map((ev, index) => ({
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
