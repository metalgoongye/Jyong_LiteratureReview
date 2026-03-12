import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

interface CallRequest {
  model: string
  messages: Message[]
  response_format?: { type: 'json_object' }
  temperature?: number
  max_tokens?: number
}

export async function callOpenRouter(req: CallRequest): Promise<string> {
  // Extract system prompt (Anthropic uses top-level system param)
  const systemMsg = req.messages.find((m) => m.role === 'system')
  const system = typeof systemMsg?.content === 'string' ? systemMsg.content : undefined
  const userMessages = req.messages.filter((m) => m.role !== 'system')

  // Convert messages to Anthropic format
  const messages: Anthropic.MessageParam[] = userMessages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role as 'user' | 'assistant', content: m.content }
    }
    // Handle multimodal (image) content
    const content: Anthropic.ContentBlockParam[] = m.content.map((block) => {
      if (block.type === 'image_url' && block.image_url?.url) {
        const dataUrl = block.image_url.url
        const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
        if (match) {
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: match[2],
            },
          }
        }
      }
      return { type: 'text' as const, text: block.text || '' }
    })
    return { role: m.role as 'user' | 'assistant', content }
  })

  // Map model name (strip "anthropic/" prefix if present)
  const model = req.model.replace(/^anthropic\//, '')

  const response = await anthropic.messages.create({
    model,
    system,
    messages,
    max_tokens: req.max_tokens || 4000,
    temperature: req.temperature ?? 0.2,
  })

  const content = response.content[0]
  if (content.type !== 'text') throw new Error('Unexpected response type from Anthropic')
  return content.text
}
