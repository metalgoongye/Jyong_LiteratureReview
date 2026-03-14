interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

interface GeminiRequest {
  model?: string
  messages: Message[]
  response_format?: { type: 'json_object' }
  temperature?: number
  max_tokens?: number
}

export async function callGemini(req: GeminiRequest): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const model = 'gemini-2.0-flash'

  // Separate system messages from conversation
  const systemMessages = req.messages.filter((m) => m.role === 'system')
  const chatMessages = req.messages.filter((m) => m.role !== 'system')

  const systemInstruction = systemMessages.length > 0
    ? { parts: [{ text: systemMessages.map((m) => typeof m.content === 'string' ? m.content : '').join('\n') }] }
    : undefined

  const contents = chatMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: typeof m.content === 'string'
      ? [{ text: m.content }]
      : m.content.map((c) => {
          if (c.type === 'text') return { text: c.text || '' }
          if (c.type === 'image_url' && c.image_url) {
            // Gemini expects inlineData for base64 images
            const url = c.image_url.url
            if (url.startsWith('data:')) {
              const [header, data] = url.split(',')
              const mimeType = header.split(':')[1].split(';')[0]
              return { inlineData: { mimeType, data } }
            }
          }
          return { text: '' }
        }),
  }))

  const generationConfig: Record<string, unknown> = {
    temperature: req.temperature ?? 0.2,
    maxOutputTokens: req.max_tokens ?? 8192,
  }
  if (req.response_format?.type === 'json_object') {
    generationConfig.responseMimeType = 'application/json'
  }

  const body: Record<string, unknown> = { contents, generationConfig }
  if (systemInstruction) body.systemInstruction = systemInstruction

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!content) throw new Error('Empty response from Gemini')
  return content
}
