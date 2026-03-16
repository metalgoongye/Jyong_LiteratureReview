import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth') as typeof import('mammoth')

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: sessions, error } = await supabase
    .from('cpr_sessions')
    .select('id, title, status, created_at, synthesis_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: sessions || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const docFile = formData.get('docFile') as File | null
  const reviewerComments = formData.get('reviewerComments') as string | null
  const reviewerFile = formData.get('reviewerFile') as File | null
  const synthesisId = formData.get('synthesisId') as string | null

  if (!docFile) {
    return NextResponse.json({ error: '논문 파일이 필요합니다' }, { status: 400 })
  }

  const docBuffer = Buffer.from(await docFile.arrayBuffer())

  // Extract plain text for AI processing
  const { value: originalText } = await mammoth.extractRawText({ buffer: docBuffer })

  if (!originalText?.trim()) {
    return NextResponse.json({ error: '문서에서 텍스트를 추출할 수 없습니다' }, { status: 400 })
  }

  // Extract HTML to preserve formatting (headings, bold, etc.)
  const { value: originalHtml } = await mammoth.convertToHtml({ buffer: docBuffer })

  // Parse reviewer comments file if provided
  let combinedReviewerComments = reviewerComments || ''
  if (reviewerFile) {
    const reviewerBuffer = Buffer.from(await reviewerFile.arrayBuffer())
    const { value: reviewerText } = await mammoth.extractRawText({ buffer: reviewerBuffer })
    if (reviewerText?.trim()) {
      combinedReviewerComments = combinedReviewerComments
        ? `${combinedReviewerComments}\n\n${reviewerText}`
        : reviewerText
    }
  }

  // Extract title from first non-empty line
  const firstLine = originalText.split('\n').find((l: string) => l.trim())?.trim() || '제목 없음'
  const title = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine

  const { data: session, error } = await supabase
    .from('cpr_sessions')
    .insert({
      user_id: user.id,
      title,
      original_text: originalText,
      original_html: originalHtml,
      reviewer_comments: combinedReviewerComments || null,
      synthesis_id: synthesisId || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: session.id })
}
