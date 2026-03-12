'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GlassCard } from '@/components/ui/GlassCard'
import { GlassInput } from '@/components/ui/GlassInput'
import { GlassButton } from '@/components/ui/GlassButton'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/verify-email')
  }

  return (
    <GlassCard>
      <h1 className="text-xl font-semibold mb-6">회원가입</h1>
      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <GlassInput
          label="이메일 (아이디로 사용)"
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
          placeholder="8자 이상 입력"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <GlassInput
          label="비밀번호 확인"
          type="password"
          placeholder="비밀번호를 다시 입력"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}
        <GlassButton type="submit" loading={loading} className="w-full mt-2">
          가입하기
        </GlassButton>
      </form>
      <p className="text-sm text-center mt-5 opacity-60">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-medium opacity-100 underline underline-offset-2">
          로그인
        </Link>
      </p>
    </GlassCard>
  )
}
