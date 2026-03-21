import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import type { Content, ContentType, ListContentsArgs } from 'src/types/content'
import type { ProfileContext } from './index'

type ContentTab = 'all' | 'video' | 'article' | 'speaker'

// tabFromPath derives the content tab from the current URL pathname suffix.
function tabFromPath(pathname: string): ContentTab {
  const segment = pathname.split('/').pop()
  if (segment === 'videos') return 'video'
  if (segment === 'articles') return 'article'
  if (segment === 'speakers') return 'speaker'
  return 'all'
}

const limit = 12

// ProfileContents displays the content grid for a user profile (all/video/article/speaker).
export default function ProfileContents() {
  const { profile } = useOutletContext<ProfileContext>()
  const location = useLocation()
  const tab = tabFromPath(location.pathname)

  const [contents, setContents] = useState<Content[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const tabRef = useRef(tab)
  const userIdRef = useRef(profile.user.id)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Keep refs in sync
  tabRef.current = tab
  userIdRef.current = profile.user.id

  // Build query params for content list
  const buildParams = useCallback((userID: string, currentTab: ContentTab, pageNum: number): ListContentsArgs => {
    const params: ListContentsArgs = { page: pageNum, limit }
    if (currentTab === 'speaker') {
      params.speaker_id = userID
    } else {
      params.author_id = userID
      if (currentTab === 'video') params.type = 'video' as ContentType
      if (currentTab === 'article') params.type = 'article' as ContentType
    }
    return params
  }, [])

  // Fetch contents by page
  const fetchContents = useCallback(async (userID: string, currentTab: ContentTab, pageNum: number, append: boolean) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    try {
      const params = buildParams(userID, currentTab, pageNum)
      const res = await listContents(params)
      const newContents = res.data.contents || []
      if (append) {
        setContents((prev) => [...prev, ...newContents])
      } else {
        setContents(newContents)
      }
      const more = newContents.length === limit
      setHasMore(more)
      hasMoreRef.current = more
    } catch {
      if (!append) setContents([])
      setHasMore(false)
      hasMoreRef.current = false
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [buildParams])

  // Stable infinite scroll observer — reads latest values from refs
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
          const nextPage = pageRef.current + 1
          pageRef.current = nextPage
          fetchContents(userIdRef.current, tabRef.current, nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { observerRef.current?.disconnect() }
  }, [fetchContents])

  // Reset and fetch first page when tab changes, then re-observe sentinel
  useEffect(() => {
    pageRef.current = 1
    hasMoreRef.current = true
    loadingRef.current = false
    setContents([])
    setHasMore(true)

    ;(async () => {
      await fetchContents(profile.user.id, tab, 1, false)
      // Re-observe sentinel so observer fires if it's already in viewport
      if (observerRef.current && loadMoreRef.current) {
        observerRef.current.unobserve(loadMoreRef.current)
        observerRef.current.observe(loadMoreRef.current)
      }
    })()
  }, [tab, profile.user.id, fetchContents])

  return (
    <>
      {contents.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          暂无内容
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} hideAuthor />
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && '加载中...'}
        {!hasMore && contents.length > 0 && '没有更多内容了'}
      </div>
    </>
  )
}
