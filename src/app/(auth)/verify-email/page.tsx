import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'

export default function VerifyEmailPage() {
  return (
    <GlassCard className="text-center">
      <div className="flex justify-center mb-5">
        <div
          style={{
            width: 56,
            height: 56,
            background: 'rgba(0,0,0,0.06)',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>
      </div>
      <h1 className="text-xl font-semibold mb-3">이메일을 확인해주세요</h1>
      <p className="text-sm opacity-60 mb-6 leading-relaxed">
        가입하신 이메일로 인증 링크를 발송했습니다.
        <br />
        링크를 클릭하면 가입이 완료됩니다.
      </p>
      <p className="text-xs opacity-40">
        이메일이 오지 않으면 스팸함을 확인하거나{' '}
        <Link href="/signup" className="underline underline-offset-2">
          다시 시도
        </Link>
        해주세요.
      </p>
    </GlassCard>
  )
}
