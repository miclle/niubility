import { useRef, useCallback } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import { useAppContext } from 'src/context/app'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ContentType } from 'src/types/content'

// Outlet context type from MainLayout (slug-based values only)
interface HomeContext {
  keyword: string
  typeFilter: ContentType | ''
  category: string
}

// chipClass returns YouTube-style chip class names based on active state.
const chipClass = (active: boolean) =>
  `inline-block rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap no-underline transition-colors cursor-pointer border-none ${
    active ? 'bg-[#0f0f0f] text-white' : 'bg-[#f2f2f2] text-[#0f0f0f] hover:bg-[#e5e5e5]'
  }`

// Home displays the content list page with infinite scroll.
// On type pages (/videos) → top chips are categories.
// On category pages (/tech) → top chips are content types.
// On home (/) → top chips are categories.
function Home() {
  const { t } = useTranslation('home')
  const { keyword, typeFilter, category } = useOutletContext<HomeContext>()
  const { categories } = useAppContext()
  const [searchParams, setSearchParams] = useSearchParams()

  // contentTypeOptions defines the type chips shown on category pages.
  const contentTypeOptions: { value: ContentType; label: string }[] = [
    { value: 'video', label: t('common:video') },
    { value: 'gallery', label: t('common:gallery') },
    { value: 'article', label: t('common:article') },
    { value: 'podcast', label: t('common:podcast') },
  ]

  // On category pages show type chips; otherwise show category chips
  const showTypeChips = !!category
  const showCategoryChips = !category

  // Read active chip state from query params
  const activeCategory = searchParams.get('category') || ''
  const activeType = searchParams.get('type') as ContentType | '' || ''

  // Final API filters: combine slug-based base + query-param refinement
  const filterCategory = category || activeCategory || ''
  const filterType = typeFilter || activeType || ''

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['contents', { category: filterCategory || undefined, type: filterType || undefined, keyword }],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, limit: 12, category: filterCategory || undefined, type: filterType || undefined, keyword: keyword || undefined }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loadMoreRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  const handleCategoryClick = (slug: string | null) => {
    if (slug) {
      setSearchParams((prev) => { prev.set('category', slug); return prev }, { replace: true })
    } else {
      setSearchParams((prev) => { prev.delete('category'); return prev }, { replace: true })
    }
  }

  const handleTypeClick = (type: ContentType | null) => {
    if (type) {
      setSearchParams((prev) => { prev.set('type', type); return prev }, { replace: true })
    } else {
      setSearchParams((prev) => { prev.delete('type'); return prev }, { replace: true })
    }
  }

  return (
    <div className="p-6" data-testid="home-page">
      {/* Category chips — shown on home and type pages (/videos, /galleries, /articles) */}
      {showCategoryChips && (
        <div className="flex gap-2 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button className={chipClass(!activeCategory)} onClick={() => handleCategoryClick(null)}>{t('common:all')}</button>
          {categories.map((cat) => (
            <button key={cat.slug} className={chipClass(activeCategory === cat.slug)} onClick={() => handleCategoryClick(cat.slug)}>{cat.name}</button>
          ))}
        </div>
      )}

      {/* Type chips — shown on category pages (/<category-slug>) */}
      {showTypeChips && (
        <div className="flex gap-2 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button className={chipClass(!activeType)} onClick={() => handleTypeClick(null)}>{t('common:all')}</button>
          {contentTypeOptions.map((opt) => (
            <button key={opt.value} className={chipClass(activeType === opt.value)} onClick={() => handleTypeClick(opt.value)}>{opt.label}</button>
          ))}
        </div>
      )}

      {/* Content grid - 4 cards per row */}
      {contents.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          {t('home:noContentYet')}
        </div>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
          }}
        >
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      {/* Loading indicator / Infinite scroll trigger */}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && t('home:loading')}
        {!hasNextPage && contents.length > 0 && t('home:noMore')}
      </div>
    </div>
  )
}

export default Home
