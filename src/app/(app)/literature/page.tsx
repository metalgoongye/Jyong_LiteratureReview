import { createClient } from '@/lib/supabase/server'
import { LiteratureCard } from '@/components/literature/LiteratureCard'
import { LiteratureTable } from '@/components/literature/LiteratureTable'
import { LiteratureSearch } from '@/components/literature/LiteratureSearch'
import Link from 'next/link'
import { RESEARCH_FIELDS } from '@/types/literature'

interface SearchParams {
  field?: string
  year?: string
  search?: string
  view?: string
}

export default async function LiteratureListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase
    .from('literature')
    .select('*')
    .eq('user_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (sp.field) {
    query = query.contains('fields', [sp.field])
  }

  if (sp.year) {
    query = query.eq('year', parseInt(sp.year))
  }

  const { data: literature } = await query.limit(200)

  // Client-side search across title, authors, journal
  const q = sp.search?.toLowerCase() || ''
  const items = (literature || []).filter((lit) => {
    if (!q) return true
    const inTitle = (lit.title || '').toLowerCase().includes(q)
    const inJournal = (lit.journal_name || '').toLowerCase().includes(q)
    const inAuthors = (lit.authors || []).some((a: string) =>
      a.toLowerCase().includes(q)
    )
    return inTitle || inJournal || inAuthors
  })

  // Get all unique years for filter
  const { data: allLit } = await supabase
    .from('literature')
    .select('year, fields')
    .eq('user_id', user!.id)
    .is('deleted_at', null)

  const years = [...new Set((allLit || []).map((l) => l.year).filter(Boolean))].sort(
    (a, b) => (b as number) - (a as number)
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Filter sidebar */}
      <aside
        className="w-52 flex-shrink-0 overflow-auto py-6 px-4"
        style={{ borderRight: '1px solid rgba(0,0,0,0.06)' }}
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider opacity-40 mb-4">필터</h2>

        {/* Field filter */}
        <div className="mb-5">
          <p className="text-xs opacity-40 mb-2">분야</p>
          <div className="flex flex-col gap-1">
            <Link
              href="/literature"
              className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${
                !sp.field ? 'nav-item-active font-medium' : 'opacity-50 hover:opacity-80'
              }`}
            >
              전체
            </Link>
            {RESEARCH_FIELDS.map((field) => (
              <Link
                key={field}
                href={`/literature?field=${encodeURIComponent(field)}`}
                className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${
                  sp.field === field ? 'nav-item-active font-medium' : 'opacity-50 hover:opacity-80'
                }`}
              >
                {field}
              </Link>
            ))}
          </div>
        </div>

        {/* Year filter */}
        {years.length > 0 && (
          <div>
            <p className="text-xs opacity-40 mb-2">연도</p>
            <div className="flex flex-col gap-1">
              {years.slice(0, 8).map((year) => (
                <Link
                  key={year}
                  href={`/literature?year=${year}`}
                  className={`text-xs px-2 py-1.5 rounded-lg transition-colors ${
                    sp.year === String(year) ? 'nav-item-active font-medium' : 'opacity-50 hover:opacity-80'
                  }`}
                >
                  {year}
                </Link>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold">문헌 목록</h1>
            <p className="text-xs opacity-40 mt-0.5">{items.length}개 문헌</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
              <Link
                href={`/literature${sp.field ? `?field=${encodeURIComponent(sp.field)}` : ''}${sp.year ? `?year=${sp.year}` : ''}`}
                className="px-3 py-1.5 transition-colors"
                style={{ background: sp.view !== 'table' ? 'rgba(0,0,0,0.08)' : 'transparent' }}
                title="아이콘 보기"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: sp.view !== 'table' ? 1 : 0.4 }}>
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </Link>
              <Link
                href={`/literature?view=table${sp.field ? `&field=${encodeURIComponent(sp.field)}` : ''}${sp.year ? `&year=${sp.year}` : ''}`}
                className="px-3 py-1.5 transition-colors"
                style={{ background: sp.view === 'table' ? 'rgba(0,0,0,0.08)' : 'transparent' }}
                title="자세히 보기"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: sp.view === 'table' ? 1 : 0.4 }}>
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </Link>
            </div>
            <Link href="/upload" className="glass-button-primary px-4 py-2 text-sm rounded-xl">
              + 추가
            </Link>
          </div>
        </div>

        {/* Search bar */}
        <LiteratureSearch defaultValue={sp.search || ''} />

        {/* Results */}
        <div className="mt-4">
          {items.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="opacity-40 text-sm">
                {sp.search ? `"${sp.search}" 검색 결과가 없습니다` : '문헌이 없습니다'}
              </p>
            </div>
          ) : sp.view === 'table' ? (
            <LiteratureTable items={items} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((lit) => (
                <LiteratureCard key={lit.id} literature={lit} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
