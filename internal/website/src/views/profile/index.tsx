import { useState, useEffect } from 'react'
import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, FileText, Heart, Video, BookOpen, Mic, MapPin, Github, Globe, ExternalLink, UserCheck, Users, Bookmark, Images } from 'lucide-react'
import dayjs from 'dayjs'

import { useAppContext } from 'src/context/app'
import { getUserProfile, toggleFollow } from 'src/api/user'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { UserProfileResponse, User } from 'src/types/user'

// ProfileContext is the outlet context shared with profile child routes.
export interface ProfileContext {
  profile: UserProfileResponse
  setProfile: React.Dispatch<React.SetStateAction<UserProfileResponse | null>>
  currentUser: User | undefined
}

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

// Tab navigation items with route paths.
const profileTabs: { label: string; path: string; icon: React.ReactNode }[] = [
  { label: '全部', path: '', icon: <FileText size={16} /> },
  { label: '视频', path: 'videos', icon: <Video size={16} /> },
  { label: '图集', path: 'galleries', icon: <Images size={16} /> },
  { label: '文章', path: 'articles', icon: <BookOpen size={16} /> },
  { label: '主讲', path: 'speakers', icon: <Mic size={16} /> },
  { label: '关注', path: 'following', icon: <UserCheck size={16} /> },
  { label: '粉丝', path: 'followers', icon: <Users size={16} /> },
  { label: '收藏', path: 'favorites', icon: <Bookmark size={16} /> },
]

// FollowButton renders a follow/unfollow button for a user.
export function FollowButton({ username, following: initialFollowing, onToggle }: { username: string; following: boolean; onToggle?: (following: boolean, followerCount: number, followingCount: number) => void }) {
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
export function UserListItem({ user, currentUserID, isFollowingTab }: { user: User; currentUserID?: string; isFollowingTab: boolean }) {
  const navigate = useNavigate()
  const isMe = currentUserID === user.id

  return (
    <div className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-black/5 transition-colors cursor-pointer" onClick={() => navigate(`/@${user.username}`)}>
      <Avatar style={{ width: 48, height: 48 }}>
        <SiteAvatarImage src={user.avatar} alt={user.name} />
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

// ProfileLayout renders the profile header, tab navigation, and child route outlet.
export default function ProfileLayout() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAppContext()
  const username = slug?.replace(/^@/, '')
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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
  const basePath = `/@${user.username}`

  return (
    <>
      {/* Profile header */}
      <div className="mx-auto px-6 pt-8 pb-4" style={{ maxWidth: 1284 }}>
        <div className="flex items-start gap-6">
          {/* Large avatar */}
          <Avatar style={{ width: 160, height: 160 }}>
            <SiteAvatarImage src={user.avatar} alt={user.name} />
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
                onClick={() => navigate(`${basePath}/following`)}
              >
                <span style={{ color: '#0f0f0f', fontWeight: 600 }}>{user.following_count}</span> 关注
              </button>
              <button
                className="flex items-center gap-1 hover:underline cursor-pointer bg-transparent border-0 p-0 text-sm"
                style={{ color: '#606060' }}
                onClick={() => navigate(`${basePath}/followers`)}
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

      {/* Tabs — full-width border, sticky below top nav */}
      <div className="sticky top-14 z-40 border-b bg-white" style={{ borderColor: '#e5e5e5' }}>
        <div className="mx-auto flex gap-1 px-6" style={{ maxWidth: 1284 }}>
          {profileTabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path ? `${basePath}/${tab.path}` : basePath}
              end={!tab.path}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors no-underline"
              style={({ isActive }) => ({
                borderColor: isActive ? '#0f0f0f' : 'transparent',
                color: isActive ? '#0f0f0f' : '#606060',
                background: 'none',
                cursor: 'pointer',
              })}
            >
              {tab.icon}
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Child route content */}
      <div className="mx-auto p-6" style={{ maxWidth: 1284 }}>
        <Outlet context={{ profile, setProfile, currentUser: currentUser ?? undefined } satisfies ProfileContext} />
      </div>
    </>
  )
}
