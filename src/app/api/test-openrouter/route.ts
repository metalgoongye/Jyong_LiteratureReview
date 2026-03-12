import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set in Vercel env vars' }, { status: 500 })
  }

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say OK' }],
    })
    return NextResponse.json({
      ok: true,
      keyPrefix: apiKey.substring(0, 14) + '...',
      response: response.content[0],
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      keyPrefix: apiKey.substring(0, 14) + '...',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
