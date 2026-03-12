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

export function truncateTextForAI(text: string, maxWords = 12000): string {
  const words = text.split(/\s+/)
  if (words.length <= maxWords) return text
  return words.slice(0, maxWords).join(' ') + '\n\n[NOTE: Document truncated at 12,000 words for processing.]'
}
