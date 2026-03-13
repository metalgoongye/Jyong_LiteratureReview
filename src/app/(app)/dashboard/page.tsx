import { createClient } from '@/lib/supabase/server'
import { LiteratureCard } from '@/components/literature/LiteratureCard'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: literature } = await supabase
    .from('literature')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(12)

  const items = literature || []
  const total = items.length
  const completed = items.filter((i) => i.extraction_status === 'completed').length
  const avgAccuracy =
    completed > 0
      ? items
          .filter((i) => i.extraction_accuracy != null)
          .reduce((acc, i) => acc + (i.extraction_accuracy || 0), 0) / completed
      : null

  // Field distribution
  const fieldCount: Record<string, number> = {}
  items.forEach((lit) => {
    ;(lit.fields || []).forEach((f: string) => {
      fieldCount[f] = (fieldCount[f] || 0) + 1
    })
  })
  const topFields = Object.entries(fieldCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">대시보드</h1>
          <p className="text-sm opacity-50 mt-0.5">나의 문헌 리뷰 현황</p>
        </div>
        <Link
          href="/upload"
          className="glass-button-primary px-5 py-2.5 text-sm rounded-xl"
        >
          + 문헌 추가
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="glass-card p-5">
          <p className="text-xs opacity-50 mb-1">전체 문헌</p>
          <p className="text-2xl font-semibold">{total}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs opacity-50 mb-1">분석 완료</p>
          <p className="text-2xl font-semibold">{completed}</p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs opacity-50 mb-1">평균 정확도</p>
          <p className="text-2xl font-semibold">
            {avgAccuracy !== null ? `${avgAccuracy.toFixed(1)}%` : '-'}
          </p>
          {avgAccuracy !== null && (() => {
            const band = avgAccuracy >= 90 ? 3 : avgAccuracy >= 70 ? 7 : 12
            const lo = Math.max(0, avgAccuracy - band).toFixed(0)
            const hi = Math.min(100, avgAccuracy + band).toFixed(0)
            const color = avgAccuracy >= 90 ? '#16a34a' : avgAccuracy >= 70 ? '#d97706' : '#dc2626'
            return (
              <p className="text-xs mt-0.5" style={{ color, opacity: 0.75 }}>
                {lo}% ~ {hi}%
              </p>
            )
          })()}
          <div className="flex gap-3 mt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '10px' }}>
            <span className="text-xs" style={{ color: '#16a34a', opacity: 0.8 }}>● 90%+ 우수</span>
            <span className="text-xs" style={{ color: '#d97706', opacity: 0.8 }}>● 70–89% 보통</span>
            <span className="text-xs" style={{ color: '#dc2626', opacity: 0.8 }}>● ~69% 미흡</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {total === 0 ? (
        <div className="glass-card p-16 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.05)' }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-30">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <p className="opacity-40 text-sm mb-4">아직 문헌이 없습니다</p>
          <Link
            href="/upload"
            className="glass-button-primary px-6 py-2.5 text-sm rounded-xl inline-block"
          >
            첫 문헌 업로드 →
          </Link>
        </div>
      ) : (
        <div className="flex gap-8">
          {/* Literature grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium opacity-60">최근 문헌</h2>
              <Link href="/literature" className="text-xs opacity-40 hover:opacity-70">
                전체 보기 →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((lit) => (
                <LiteratureCard key={lit.id} literature={lit} />
              ))}
            </div>
          </div>

          {/* Field distribution sidebar */}
          {topFields.length > 0 && (
            <div className="w-52 flex-shrink-0">
              <h2 className="text-sm font-medium opacity-60 mb-4">분야별 분포</h2>
              <div className="glass-card p-4 flex flex-col gap-3">
                {topFields.map(([field, count]) => (
                  <div key={field}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="opacity-70 truncate">{field}</span>
                      <span className="opacity-40">{count}</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                      <div
                        className="h-1 rounded-full"
                        style={{
                          background: '#0a0a0a',
                          width: `${(count / total) * 100}%`,
                          opacity: 0.5,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
