import { useState, useEffect, useCallback, useRef } from 'react'
import { useOutletContext } from 'react-router-dom'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import type { Content, ContentType } from 'src/types/content'

// Outlet context type from MainLayout
interface HomeContext {
  keyword: string
  typeFilter: ContentType | ''
  category: string
}

// Home displays the content list page with infinite scroll, receiving filters from MainLayout.
function Home() {
  const { keyword, typeFilter, category } = useOutletContext<HomeContext>()

  const [contents, setContents] = useState<Content[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const limit = 12
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)

  // Fetch contents for a specific page
  const fetchContents = useCallback(async (pageNum: number, append: boolean = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
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
      const more = newContents.length === limit
      setHasMore(more)
      hasMoreRef.current = more
    } catch {
      if (!append) {
        setContents([])
      }
      setHasMore(false)
      hasMoreRef.current = false
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [category, typeFilter, keyword, limit])

  // Reset and fetch first page when filters change
  useEffect(() => {
    pageRef.current = 1
    setContents([])
    setHasMore(true)
    hasMoreRef.current = true
    fetchContents(1, false)
  }, [category, typeFilter, keyword, fetchContents])

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          const nextPage = pageRef.current + 1
          pageRef.current = nextPage
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
  }, [fetchContents])

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
