import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUrl } from '@/lib/storage/upload'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const storagePath = request.nextUrl.searchParams.get('storagePath')
  if (!storagePath) return NextResponse.json({ error: 'storagePath required' }, { status: 400 })

  // Verify the user owns this file (path starts with userId)
  if (!storagePath.startsWith(user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const url = await getSignedUrl(storagePath)
    return NextResponse.json({ url })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    )
  }
}
