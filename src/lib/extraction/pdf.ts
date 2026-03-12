// pdf-parse v1.1.1 - exports function directly via module.exports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  dataBuffer: Buffer,
  options?: { max?: number; pagerender?: (pageData: { pageIndex: number; getTextContent: () => Promise<{ items: { str: string }[] }> }) => Promise<string> }
) => Promise<{ text: string; numpages: number }>

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pages: string[] = []

  await pdfParse(buffer, {
    max: 0,
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent()
      const pageText = textContent.items.map((item) => item.str).join(' ')
      const pageNum = pageData.pageIndex + 1
      pages.push(`[PAGE ${pageNum}]\n${pageText}`)
      return pageText
    },
  })

  return pages.join('\n\n')
}

export function truncateTextForAI(text: string, maxChars = 40000): string {
  if (text.length <= maxChars) return text
  // Take first 30000 chars (intro/methods) + last 10000 chars (results/conclusion)
  const head = text.slice(0, 30000)
  const tail = text.slice(-10000)
  return (
    head +
    '\n\n[...middle section omitted...]\n\n' +
    tail +
    '\n\n[NOTE: Document truncated for processing.]'
  )
}
