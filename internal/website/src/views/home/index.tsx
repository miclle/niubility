import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import type { Content, ContentCategory, ContentType } from 'src/types/content'

// Outlet context type from MainLayout
interface HomeContext {
  keyword: string
  typeFilter: ContentType | ''
  category: ContentCategory
}

// Home displays the content list page with infinite scroll, receiving filters from MainLayout.
function Home() {
  const { keyword, typeFilter, category } = useOutletContext<HomeContext>()

  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const limit = 12
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Fetch contents for a specific page
  const fetchContents = useCallback(async (pageNum: number, append: boolean = false) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await listContents({
        page: pageNum,
        limit,
        category,
        type: typeFilter || undefined,
        keyword: keyword || undefined,
      })
      const newContents = res.data.contents || []
      if (append) {
        setContents((prev) => [...prev, ...newContents])
      } else {
        setContents(newContents)
      }
      // Check if there are more items to load
      setHasMore(newContents.length === limit)
    } catch {
      if (!append) {
        setContents([])
      }
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [category, typeFilter, keyword, loading, limit])

  // Reset and fetch first page when filters change
  useEffect(() => {
    setPage(1)
    setContents([])
    setHasMore(true)
    fetchContents(1, false)
  }, [category, typeFilter, keyword])

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchContents(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [page, hasMore, loading, fetchContents])

  return (
    <div className="p-6">
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
        {!hasMore && contents.length > 0 && '没有更多内容了'}
      </div>
    </div>
  )
}

export default Home
