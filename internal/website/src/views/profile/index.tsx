import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CalendarDays, FileText, Heart, Video, BookOpen, Mic, MapPin, Github, Globe, ExternalLink, UserCheck, Users } from 'lucide-react'
import dayjs from 'dayjs'

import { useAppContext } from 'src/context/app'
import { getUserProfile, toggleFollow, listFollowing, listFollowers } from 'src/api/user'
import { listContents } from 'src/api/content'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import ContentCard from 'src/components/ContentCard'
import type { UserProfileResponse, User } from 'src/types/user'
import type { Content, ContentType, ListContentsArgs } from 'src/types/content'

// socialIconMap maps social account keys to Lucide icon components.
const socialIconMap: Record<string, typeof Github> = {
  github: Github,
  website: Globe,
}

// socialLinkEntries filters and maps social accounts to renderable entries.
function socialLinkEntries(accounts: Record<string, string>) {
  return Object.entries(accounts)
    .filter(([, url]) => url)
    .map(([key, url]) => ({
      key,
      url,
      icon: socialIconMap[key] || ExternalLink,
    }))
}

type TabKey = 'all' | 'video' | 'article' | 'speaker' | 'following' | 'followers'

const contentTabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: '全部', icon: <FileText size={16} /> },
  { key: 'video', label: '视频', icon: <Video size={16} /> },
  { key: 'article', label: '文章', icon: <BookOpen size={16} /> },
  { key: 'speaker', label: '主讲', icon: <Mic size={16} /> },
  { key: 'following', label: '关注', icon: <UserCheck size={16} /> },
  { key: 'followers', label: '粉丝', icon: <Users size={16} /> },
]

// FollowButton renders a follow/unfollow button for a user.
function FollowButton({ username, following: initialFollowing, onToggle }: { username: string; following: boolean; onToggle?: (following: boolean, followerCount: number, followingCount: number) => void }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setFollowing(initialFollowing) }, [initialFollowing])

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await toggleFollow(username)
      setFollowing(res.data.following)
      onToggle?.(res.data.following, res.data.follower_count, res.data.following_count)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border"
      style={following
        ? { background: 'transparent', color: '#606060', borderColor: '#e5e5e5' }
        : { background: '#0f0f0f', color: '#ffffff', borderColor: '#0f0f0f' }
      }
    >
      {following ? '已关注' : '关注'}
    </button>
  )
}

// UserListItem renders a single user row in following/followers lists.
function UserListItem({ user, currentUserID, isFollowingTab }: { user: User; currentUserID?: string; isFollowingTab: boolean }) {
  const navigate = useNavigate()
  const isMe = currentUserID === user.id

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-black/5 transition-colors cursor-pointer" onClick={() => navigate(`/@${user.username}`)}>
      <Avatar style={{ width: 48, height: 48 }}>
        <AvatarImage src={user.avatar} alt={user.name} />
        <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: '#0f0f0f' }}>{user.name || user.username}</div>
        <div className="text-xs" style={{ color: '#606060' }}>@{user.username}</div>
        {user.bio && <div className="text-xs mt-0.5 truncate" style={{ color: '#606060' }}>{user.bio}</div>}
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: '#606060' }}>
        <span>{user.follower_count} 粉丝</span>
        {!isMe && (
          <FollowButton username={user.username} following={isFollowingTab} />
        )}
      </div>
    </div>
  )
}

// UserProfile displays a user's public profile page with content tabs.
function UserProfile() {
  const { slug } = useParams<{ slug: string }>()
  const { currentUser } = useAppContext()
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

  // Follow list state
  const [followUsers, setFollowUsers] = useState<User[]>([])
  const [followPage, setFollowPage] = useState(1)
  const [followHasMore, setFollowHasMore] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const followLoadingRef = useRef(false)
  const followObserverRef = useRef<IntersectionObserver | null>(null)
  const followLoadMoreRef = useRef<HTMLDivElement>(null)

  const isFollowTab = activeTab === 'following' || activeTab === 'followers'

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

  // Fetch follow users by page
  const fetchFollowUsers = useCallback(async (username: string, tab: 'following' | 'followers', pageNum: number, append: boolean) => {
    if (followLoadingRef.current) return
    followLoadingRef.current = true
    setFollowLoading(true)

    try {
      const fetcher = tab === 'following' ? listFollowing : listFollowers
      const res = await fetcher(username, { page: pageNum, limit: 20 })
      const newUsers = res.data.users || []
      if (append) {
        setFollowUsers((prev) => [...prev, ...newUsers])
      } else {
        setFollowUsers(newUsers)
      }
      setFollowHasMore(newUsers.length === 20)
    } catch {
      if (!append) setFollowUsers([])
      setFollowHasMore(false)
    } finally {
      followLoadingRef.current = false
      setFollowLoading(false)
    }
  }, [])

  // Reset and fetch first page when tab changes or profile loads
  useEffect(() => {
    if (!profile) return

    if (isFollowTab) {
      setFollowPage(1)
      setFollowUsers([])
      setFollowHasMore(true)
      fetchFollowUsers(profile.user.username, activeTab as 'following' | 'followers', 1, false)
    } else {
      setPage(1)
      setContents([])
      setHasMore(true)
      fetchContents(profile.user.id, activeTab, 1, false)
    }
  }, [activeTab, profile, fetchContents, fetchFollowUsers, isFollowTab])

  // Infinite scroll observer for content
  useEffect(() => {
    if (isFollowTab) return
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
  }, [page, hasMore, fetchContents, profile, activeTab, isFollowTab])

  // Infinite scroll observer for follow lists
  useEffect(() => {
    if (!isFollowTab) return
    if (followObserverRef.current) followObserverRef.current.disconnect()

    followObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && followHasMore && !followLoadingRef.current && profile) {
          const nextPage = followPage + 1
          setFollowPage(nextPage)
          fetchFollowUsers(profile.user.username, activeTab as 'following' | 'followers', nextPage, true)
        }
      },
      { threshold: 0.1 }
    )

    if (followLoadMoreRef.current) followObserverRef.current.observe(followLoadMoreRef.current)

    return () => { followObserverRef.current?.disconnect() }
  }, [followPage, followHasMore, fetchFollowUsers, profile, activeTab, isFollowTab])

  // Handle follow toggle on profile header
  const handleProfileFollowToggle = (following: boolean, followerCount: number, followingCount: number) => {
    if (profile) {
      setProfile({
        ...profile,
        following,
        user: { ...profile.user, follower_count: followerCount, following_count: followingCount },
      })
    }
  }

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

  const { user, content_count, total_likes, speaker_content_count, following } = profile
  const isOwnProfile = currentUser?.id === user.id

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
            <div className="flex items-center gap-4">
              <h1 className="font-bold" style={{ color: '#0f0f0f', fontSize: 36 }}>{user.name}</h1>
              {!isOwnProfile && currentUser && (
                <FollowButton username={user.username} following={following} onToggle={handleProfileFollowToggle} />
              )}
            </div>
            <div className="text-sm mt-1" style={{ color: '#606060' }}>
              @{user.username}
            </div>

            {user.bio && (
              <p className="text-sm mt-3" style={{ color: '#0f0f0f' }}>{user.bio}</p>
            )}

            {/* Stats & join date */}
            <div className="flex items-center gap-4 mt-3 text-sm flex-wrap" style={{ color: '#606060' }}>
              <span className="flex items-center gap-1">
                <CalendarDays size={14} />
                {dayjs(user.created_at).format('YYYY 年 M 月')}加入
              </span>
              {user.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {user.location}
                </span>
              )}
              <button
                className="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 p-0 text-sm"
                style={{ color: '#606060' }}
                onClick={() => setActiveTab('following')}
              >
                <span style={{ color: '#0f0f0f', fontWeight: 600 }}>{user.following_count}</span> 关注
              </button>
              <button
                className="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 p-0 text-sm"
                style={{ color: '#606060' }}
                onClick={() => setActiveTab('followers')}
              >
                <span style={{ color: '#0f0f0f', fontWeight: 600 }}>{user.follower_count}</span> 粉丝
              </button>
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

            {/* Social accounts */}
            {user.social_accounts && Object.values(user.social_accounts).some(Boolean) && (
              <div className="flex items-center gap-3 mt-3">
                {socialLinkEntries(user.social_accounts).map(({ key, url, icon: Icon }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
                    style={{ color: '#606060' }}
                    title={key}
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b" style={{ borderColor: '#e5e5e5' }}>
        <div className="flex gap-1">
          {contentTabs.map((tab) => (
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

      {/* Content area */}
      <div className="p-6">
        {isFollowTab ? (
          <>
            {followUsers.length === 0 && !followLoading ? (
              <div className="text-center py-20" style={{ color: '#606060' }}>
                {activeTab === 'following' ? '暂未关注任何人' : '暂无粉丝'}
              </div>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {followUsers.map((u) => (
                  <UserListItem key={u.id} user={u} currentUserID={currentUser?.id} isFollowingTab={activeTab === 'following'} />
                ))}
              </div>
            )}
            <div ref={followLoadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
              {followLoading && '加载中...'}
              {!followHasMore && followUsers.length > 0 && '没有更多了'}
            </div>
          </>
        ) : (
          <>
            {contents.length === 0 && !contentLoading ? (
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
              {contentLoading && '加载中...'}
              {!hasMore && contents.length > 0 && '没有更多内容了'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default UserProfile
