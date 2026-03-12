'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassButton } from '@/components/ui/GlassButton'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : authError.message)
        setLoading(false)
        return
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('Failed')) {
        setError('Supabase 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요. (무료 플랜의 경우 프로젝트가 일시 정지됐을 수 있습니다)')
      } else {
        setError(`오류: ${errMsg}`)
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <GlassCard>
      <h1 className="text-xl font-semibold mb-6">로그인</h1>
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <GlassInput
          label="이메일"
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <GlassInput
          label="비밀번호"
          type="password"
          placeholder="비밀번호를 입력하세요"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <GlassButton type="submit" loading={loading} className="w-full mt-2">
          로그인
        </GlassButton>
      </form>
      <p className="text-sm text-center mt-5 opacity-60">
        계정이 없으신가요?{' '}
        <Link href="/signup" className="font-medium opacity-100 underline underline-offset-2">
          회원가입
        </Link>
      </p>
    </GlassCard>
  )
}
