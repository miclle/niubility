import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarDays, FileText, Heart, Video, BookOpen, Mic } from 'lucide-react'
import dayjs from 'dayjs'

import { getUserProfile } from 'src/api/user'
import { listContents } from 'src/api/content'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import ContentCard from 'src/components/ContentCard'
import type { UserProfileResponse } from 'src/types/user'
import type { Content, ContentType, ListContentsArgs } from 'src/types/content'

type TabKey = 'all' | 'video' | 'article' | 'speaker'

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: '全部', icon: <FileText size={16} /> },
  { key: 'video', label: '视频', icon: <Video size={16} /> },
  { key: 'article', label: '文章', icon: <BookOpen size={16} /> },
  { key: 'speaker', label: '主讲', icon: <Mic size={16} /> },
]

// UserProfile displays a user's public profile page with content tabs.
function UserProfile() {
  const { slug } = useParams<{ slug: string }>()
  const username = slug?.replace(/^@/, '')
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [contentLoading, setContentLoading] = useState(false)
  const contentLoadingRef = useRef(false)
  const limit = 12
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Fetch profile data
  useEffect(() => {
    if (!username) return
    setLoading(true)
    setNotFound(false)
    getUserProfile(username)
      .then((res) => setProfile(res.data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setNotFound(true)
        }
      })
      .finally(() => setLoading(false))
  }, [username])

  // Build query params for content list
  const buildParams = useCallback((userID: string, tab: TabKey, pageNum: number): ListContentsArgs => {
    const params: ListContentsArgs = { page: pageNum, limit }
    if (tab === 'speaker') {
      params.speaker_id = userID
    } else {
      params.author_id = userID
      if (tab === 'video') params.type = 'video' as ContentType
      if (tab === 'article') params.type = 'article' as ContentType
    }
    return params
  }, [limit])

  // Fetch contents by page
  const fetchContents = useCallback(async (userID: string, tab: TabKey, pageNum: number, append: boolean) => {
    if (contentLoadingRef.current) return
    contentLoadingRef.current = true
    setContentLoading(true)

    try {
      const params = buildParams(userID, tab, pageNum)
      const res = await listContents(params)
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
      contentLoadingRef.current = false
      setContentLoading(false)
    }
  }, [buildParams, limit])

  // Reset and fetch first page when tab changes or profile loads
  useEffect(() => {
    if (!profile) return
    setPage(1)
    setContents([])
    setHasMore(true)
    fetchContents(profile.user.id, activeTab, 1, false)
  }, [activeTab, profile, fetchContents])

  // Infinite scroll observer
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !contentLoadingRef.current && profile) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchContents(profile.user.id, activeTab, nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current)

    return () => { observerRef.current?.disconnect() }
  }, [page, hasMore, contentLoading, fetchContents, profile, activeTab])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: '#606060' }}>
        加载中...
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: '#606060' }}>
        用户不存在
      </div>
    )
  }

  const { user, content_count, total_likes, speaker_content_count } = profile

  return (
    <div className="mx-auto" style={{ maxWidth: 1284 }}>
      {/* Profile header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-start gap-6">
          {/* Large avatar */}
          <Avatar style={{ width: 160, height: 160 }}>
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback style={{ fontSize: 48 }}>{user.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold" style={{ color: '#0f0f0f', fontSize: 36 }}>{user.name}</h1>
            <div className="text-sm mt-1" style={{ color: '#606060' }}>
              @{user.username}
            </div>

            {user.bio && (
              <p className="text-sm mt-3" style={{ color: '#0f0f0f' }}>{user.bio}</p>
            )}

            {/* Stats & join date */}
            <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: '#606060' }}>
              <span className="flex items-center gap-1">
                <CalendarDays size={14} />
                {dayjs(user.created_at).format('YYYY 年 M 月')}加入
              </span>
              <span className="flex items-center gap-1">
                <FileText size={14} />
                {content_count} 篇内容
              </span>
              <span className="flex items-center gap-1">
                <Heart size={14} />
                {total_likes} 次获赞
              </span>
              {speaker_content_count > 0 && (
                <span className="flex items-center gap-1">
                  <Mic size={14} />
                  {speaker_content_count} 次主讲
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b" style={{ borderColor: '#e5e5e5' }}>
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors"
              style={{
                borderColor: activeTab === tab.key ? '#0f0f0f' : 'transparent',
                color: activeTab === tab.key ? '#0f0f0f' : '#606060',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content grid */}
      <div className="p-6">
        {contents.length === 0 && !contentLoading ? (
          <div className="text-center py-20" style={{ color: '#606060' }}>
            暂无内容
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {contents.map((content) => (
              <ContentCard key={content.id} content={content} />
            ))}
          </div>
        )}

        {/* Loading / end indicator */}
        <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
          {contentLoading && '加载中...'}
          {!hasMore && contents.length > 0 && '没有更多内容了'}
        </div>
      </div>
    </div>
  )
}

export default UserProfile
