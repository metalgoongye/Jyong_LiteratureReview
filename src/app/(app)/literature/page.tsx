import { createClient } from '@/lib/supabase/server'
import { LiteratureCard } from '@/components/literature/LiteratureCard'
import Link from 'next/link'
import { RESEARCH_FIELDS } from '@/types/literature'

interface SearchParams {
  field?: string
  year?: string
  search?: string
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

  if (sp.search) {
    query = query.or(
      `title.ilike.%${sp.search}%,authors.cs.{"${sp.search}"}`
    )
  }

  const { data: literature } = await query.limit(50)
  const items = literature || []

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

        {/* Search */}
        <div className="mb-5">
          <form>
            <input
              name="search"
              defaultValue={sp.search || ''}
              placeholder="제목, 저자 검색..."
              className="w-full px-3 py-2 text-xs rounded-lg"
              style={{
                background: 'rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.08)',
                outline: 'none',
              }}
            />
          </form>
        </div>

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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">문헌 목록</h1>
            <p className="text-xs opacity-40 mt-0.5">{items.length}개 문헌</p>
          </div>
          <Link href="/upload" className="glass-button-primary px-4 py-2 text-sm rounded-xl">
            + 추가
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="opacity-40 text-sm">문헌이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((lit) => (
              <LiteratureCard key={lit.id} literature={lit} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
