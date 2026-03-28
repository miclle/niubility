import { useNavigate } from 'react-router-dom'
import { Play, Image, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import { contentDetailPath } from 'src/lib/content-url'
import { getContentCover, getVideoSpeakerAvatar, getVideoSpeakerDisplayName } from 'src/lib/content-assets'
import { useAppContext } from 'src/context/app'
import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// ContentCard displays a content item as a card with type-specific visual indicators.
function ContentCard({ content, hideAuthor = false }: { content: Content; hideAuthor?: boolean }) {
  const navigate = useNavigate()
  const { siteConfig } = useAppContext()
  const displayUser = content.type === 'video' ? content.speaker : content.author
  const displayName = content.type === 'video' ? getVideoSpeakerDisplayName(content) : (content.author?.name || '未知作者')
  const displayAvatar = content.type === 'video' ? getVideoSpeakerAvatar(content, siteConfig) : (content.author?.avatar || '')
  const profilePath = displayUser?.username ? `/@${displayUser.username}` : ''
  const mediaItems = content.attachments || []

  const handleCardClick = () => {
    navigate(contentDetailPath(content))
  }

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (profilePath) navigate(profilePath)
  }

  const coverUrl = getContentCover(content, siteConfig)

  return (
    <div
      className="group block no-underline cursor-pointer"
      style={{ color: 'inherit' }}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="relative" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div className="relative aspect-video bg-zinc-200">
          <img
            src={coverUrl}
            alt={content.title}
            className="w-full h-full object-cover"
            style={{ transition: 'transform 0.3s' }}
          />

          {/* Type-specific overlay */}
          {content.type === 'video' && (
            <>
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.3)' }}
              >
                <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: 12 }}>
                  <Play size={32} fill="white" style={{ color: 'white' }} />
                </div>
              </div>
              {/* Video count badge */}
              {mediaItems.length > 1 && (
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                  {mediaItems.length} 个视频
                </div>
              )}
            </>
          )}

          {content.type === 'gallery' && mediaItems.length > 1 && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
              <Image size={12} />
              {mediaItems.length}
            </div>
          )}

          {content.type === 'article' && (
            <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
              <FileText size={12} />
              文章
            </div>
          )}
        </div>
      </div>

      {/* Card info */}
      <div className="flex gap-3 mt-3">
        {/* Author avatar */}
        {!hideAuthor && (
          <div className="flex-shrink-0" onClick={handleProfileClick}>
            <Avatar className={profilePath ? 'cursor-pointer' : ''}>
              <AvatarImage src={displayAvatar} alt={displayName || '匿名'} />
              <AvatarFallback>{displayName?.charAt(0) || '匿'}</AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>
            {content.title}
          </h3>
          {!hideAuthor && (
            <span
              className="text-xs mb-0.5 block hover:underline cursor-pointer"
              style={{ color: '#606060' }}
              onClick={handleProfileClick}
            >
              {displayName}
            </span>
          )}
          <div className="text-xs" style={{ color: '#606060' }}>
            {dayjs(content.created_at).fromNow()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContentCard
