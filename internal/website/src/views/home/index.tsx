import { useRef, useCallback } from 'react'
import { useOutletContext, NavLink } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import { useAppContext } from 'src/context/app'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ContentType } from 'src/types/content'

// Outlet context type from MainLayout
interface HomeContext {
  keyword: string
  typeFilter: ContentType | ''
  category: string
}

// chipClass returns YouTube-style chip class names based on active state.
const chipClass = (active: boolean) =>
  `inline-block rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap no-underline transition-colors ${
    active ? 'bg-[#0f0f0f] text-white' : 'bg-[#f2f2f2] text-[#0f0f0f] hover:bg-[#e5e5e5]'
  }`

// Home displays the content list page with infinite scroll, receiving filters from MainLayout.
function Home() {
  const { keyword, typeFilter, category } = useOutletContext<HomeContext>()
  const { categories } = useAppContext()
  const isHome = !category

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['contents', { category: category || undefined, type: typeFilter, keyword }],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, limit: 12, category: category || undefined, type: typeFilter || undefined, keyword: keyword || undefined }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loadMoreRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <div className="p-6">
      {/* YouTube-style category chips — only on homepage */}
      {isHome && (
        <div className="flex gap-2 pb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <NavLink to="/" end className={() => chipClass(isHome)}>全部</NavLink>
          {categories.map((cat) => (
            <NavLink key={cat.slug} to={`/${cat.slug}`} className={() => chipClass(false)}>{cat.name}</NavLink>
          ))}
        </div>
      )}

      {/* Content grid - 4 cards per row */}
      {contents.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          暂无内容
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
        {loading && '加载中...'}
        {!hasNextPage && contents.length > 0 && '没有更多内容了'}
      </div>
    </div>
  )
}

export default Home
