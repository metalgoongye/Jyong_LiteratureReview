import * as cheerio from 'cheerio'

export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; LitReview/1.0; +http://localhost:3000)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Remove non-content elements
  $('script, style, nav, footer, header, .nav, .footer, .header, .sidebar, .menu, .advertisement, .ad').remove()

  // Try to find the main content
  const selectors = [
    'article',
    'main',
    '.article-content',
    '.paper-content',
    '.content',
    '#content',
    '.abstract',
    'body',
  ]

  let text = ''
  for (const selector of selectors) {
    const el = $(selector)
    if (el.length > 0) {
      text = el.text()
      break
    }
  }

  // Clean up whitespace
  return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
