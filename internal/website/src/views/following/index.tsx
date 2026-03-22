import { useState, useEffect, useCallback, useRef } from 'react'
import { UserPlus } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import type { Content } from 'src/types/content'

// FollowingFeed displays contents from users that the current user follows.
function FollowingFeed() {
  const { currentUser } = useAppContext()

  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const limit = 12
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Fetch contents for a specific page
  const fetchContents = useCallback(async (pageNum: number, append: boolean = false) => {
    if (loadingRef.current || !currentUser) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await listContents({
        page: pageNum,
        limit,
        followed_by_user_id: currentUser.id,
      })
      const newContents = res.data.contents || []
      if (append) {
        setContents((prev) => [...prev, ...newContents])
      } else {
        setContents(newContents)
      }
      setHasMore(newContents.length === limit)
    } catch {
      if (!append) setContents([])
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [currentUser, limit])

  // Fetch first page on mount
  useEffect(() => {
    if (!currentUser) return
    setPage(1)
    setContents([])
    setHasMore(true)
    fetchContents(1, false)
  }, [currentUser, fetchContents])

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchContents(nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { observerRef.current?.disconnect() }
  }, [page, hasMore, fetchContents])

  return (
    <div className="p-6">
      {contents.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#606060' }}>
          <UserPlus size={48} strokeWidth={1.5} />
          <p className="text-base font-medium" style={{ color: '#0f0f0f' }}>关注感兴趣的人</p>
          <p className="text-sm">关注后，他们发布的内容将出现在这里</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && '加载中...'}
        {!hasMore && contents.length > 0 && '没有更多内容了'}
      </div>
    </div>
  )
}

export default FollowingFeed
