export function formatAuthors(authors?: string[] | null): string {
  if (!authors || authors.length === 0) return '저자 미상'
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return authors.join(', ')
  return `${authors[0]} 외 ${authors.length - 1}명`
}

export function formatYear(year?: number | null): string {
  return year ? String(year) : '연도 미상'
}

export function formatCitation(lit: {
  authors?: string[] | null
  year?: number | null
  title?: string | null
  journal_name?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
}): string {
  const parts: string[] = []
  if (lit.authors && lit.authors.length > 0) parts.push(lit.authors[0])
  if (lit.year) parts.push(`(${lit.year})`)
  if (lit.title) parts.push(lit.title)
  if (lit.journal_name) parts.push(lit.journal_name)
  const volIssue = [lit.volume, lit.issue ? `(${lit.issue})` : null]
    .filter(Boolean)
    .join('')
  if (volIssue) parts.push(volIssue)
  if (lit.pages) parts.push(`pp.${lit.pages}`)
  return parts.join('. ')
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatAccuracy(accuracy?: number | null): string {
  if (accuracy === null || accuracy === undefined) return '-'
  return `${accuracy.toFixed(1)}%`
}
