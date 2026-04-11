import { useState, useCallback, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark, Download, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { fileURL } from 'src/api/upload'
import { contentEditPath } from 'src/lib/content-url'
import { getContentCover, getDefaultContentCover, getVideoSpeakerAvatar, getVideoSpeakerDisplayName } from 'src/lib/content-assets'
import { formatFileSize } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import useContentDetail from 'src/hooks/useContentDetail'
import VideoPlayer from 'src/components/VideoPlayer'
import CommentSection from 'src/components/CommentSection'
import ShareButton from 'src/components/ShareButton'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'

// VideoDetail displays a single video content item.
function VideoDetail() {
  const { t } = useTranslation(['content', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { siteConfig } = useAppContext()

  const {
    content, relatedContents, loading, error,
    liked, likeCount, favorited, favoriteCount, commentCount, setCommentCount,
    highlightedCommentID, highlightedContent,
    handleLike, handleFavorite,
    isDraft, canEdit, categoryLabel,
  } = useContentDetail({ expectedType: 'video' })

  const [descExpanded, setDescExpanded] = useState(false)
  const [theaterMode, setTheaterMode] = useState(false)
  const [autoplay, setAutoplay] = useState(false)

  // Derive currentVideoIndex from URL search param ?v=N
  const vParam = searchParams.get('v')
  const currentVideoIndex = vParam !== null ? parseInt(vParam, 10) || 0 : 0

  const setCurrentVideoIndex = useCallback((index: number, shouldAutoplay = false) => {
    setAutoplay(shouldAutoplay)
    if (index === 0) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ v: String(index) }, { replace: true })
    }
  }, [setSearchParams])

  if (loading) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>{t('content:loading')}</div>
  }

  if (error || !content) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>{t('content:notFound')}</div>
  }

  const videoItems = (content.attachments || []).filter((m) => m.type === 'video')
  const currentVideo = videoItems[currentVideoIndex]
  const speakerDisplayName = getVideoSpeakerDisplayName(content)

  const handleDescriptionClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (descExpanded || target?.closest('a')) return
    setDescExpanded(true)
  }

  const renderActions = () => (
    <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid #e5e5e5' }}>
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <SiteAvatarImage src={getVideoSpeakerAvatar(content, siteConfig)} alt={speakerDisplayName} />
          <AvatarFallback>{speakerDisplayName.charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
            {speakerDisplayName}
          </div>
          <div className="text-xs" style={{ color: '#606060' }}>
            {dayjs(content.created_at).fromNow()}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
          style={{
            background: liked ? 'rgba(6,95,212,0.1)' : 'rgba(0,0,0,0.05)',
            color: liked ? '#065fd4' : '#0f0f0f',
            boxShadow: highlightedContent ? 'inset 0 0 0 1px rgba(6,95,212,0.28)' : undefined,
          }}
          onClick={handleLike}
        >
          <ThumbsUp size={18} fill={liked ? 'currentColor' : 'none'} />
          <span>{likeCount || 0}</span>
        </button>
        <button
          className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
          style={{ background: favorited ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.05)', color: favorited ? '#b45309' : '#0f0f0f' }}
          onClick={handleFavorite}
        >
          <Bookmark size={18} fill={favorited ? 'currentColor' : 'none'} />
          <span>{favoriteCount || 0}</span>
        </button>
        <a href="#comments" className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
          <MessageCircle size={18} />
          <span>{commentCount || 0}</span>
        </a>
        <ShareButton
          title={content.title}
          text={content.summary || content.speaker_bio || undefined}
          className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
          style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}
        />
        {canEdit && (
          <Link to={contentEditPath(content)} className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
            <Pencil size={16} />
            <span>{t('common:edit')}</span>
          </Link>
        )}
      </div>
    </div>
  )

  const renderDescription = () => (
    <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.03)', color: '#0f0f0f' }}>
      <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: '#606060' }}>
        <span>{categoryLabel}</span>
        {content.tags?.length > 0 && (
          <>
            <span>•</span>
            <span>{content.tags.join(', ')}</span>
          </>
        )}
      </div>
      {content.summary && (
        <div className={`whitespace-pre-wrap ${descExpanded ? '' : 'line-clamp-2'}`} style={{ cursor: descExpanded ? 'auto' : 'pointer' }} onClick={handleDescriptionClick}>
          {content.summary}
        </div>
      )}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <span className="font-medium">{t('content:speaker')}</span>
        {speakerDisplayName}
        {content.speaker_bio && <span className="ml-2" style={{ color: '#606060' }}>- {content.speaker_bio}</span>}
      </div>
      {(content.summary || content.speaker_name || content.speaker || content.speaker_bio) && (
        <button className="mt-2 text-sm font-medium" style={{ color: '#065fd4' }} onClick={() => setDescExpanded(!descExpanded)}>
          {descExpanded ? t('content:collapse') : t('content:expand')}
        </button>
      )}
    </div>
  )

  const renderPlaylist = () => {
    if (videoItems.length <= 1) return null
    return (
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #e5e5e5' }}>
        <div className="px-4 py-2 text-sm font-medium" style={{ background: '#f9f9f9', color: '#0f0f0f' }}>
          {t('content:playlist', { count: videoItems.length })}
        </div>
        <div>
          {videoItems.map((v, i) => (
            <button
              key={v.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer"
              style={{ background: i === currentVideoIndex ? 'rgba(0,0,0,0.05)' : 'transparent', borderTop: i > 0 ? '1px solid #f2f2f2' : 'none' }}
              onClick={() => setCurrentVideoIndex(i, true)}
            >
              <span className="text-xs font-medium w-5 text-center flex-shrink-0" style={{ color: i === currentVideoIndex ? '#065fd4' : '#909090' }}>
                {i + 1}
              </span>
              <div className="relative flex-shrink-0 rounded overflow-hidden" style={{ width: 80, aspectRatio: '16/9' }}>
                <img
                  src={fileURL(v.cover_url || content.cover_url) || getDefaultContentCover(content.type, siteConfig)}
                  alt={v.title || t('content:videoItem', { index: i + 1 })}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm line-clamp-1" style={{ color: '#0f0f0f', fontWeight: i === currentVideoIndex ? 600 : 400 }}>
                  {v.title || t('content:videoItem', { index: i + 1 })}
                </div>
                {v.description && <div className="text-xs line-clamp-1" style={{ color: '#606060' }}>{v.description}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderSidebar = () => {
    const hasPlaylist = videoItems.length > 1
    const hasRelatedContents = relatedContents.length > 0
    if (!hasPlaylist && !hasRelatedContents) return null

    return (
      <div className="hidden xl:block flex-shrink-0 w-[400px]">
        {renderPlaylist()}
        {hasRelatedContents && (
          <>
            <div className="text-sm font-medium mb-3" style={{ color: '#0f0f0f' }}>{t('content:relatedVideos')}</div>
            <div className="space-y-3">
              {relatedContents.map((item) => (
                <Link key={item.id} to={`/${item.type}s/${item.id}`} className="flex gap-2 no-underline group" style={{ color: 'inherit' }}>
                  <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100" style={{ width: 168, aspectRatio: '16/9' }}>
                    <img src={getContentCover(item, siteConfig)} alt={item.title} className="w-full h-full object-cover" />
                    {item.type === 'video' && (
                      <div className="absolute bottom-1 right-1 px-1 rounded text-xs" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>{t('common:video')}</div>
                    )}
                    {item.type === 'gallery' && (
                      <div className="absolute bottom-1 right-1 px-1 rounded text-xs" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                        {t('content:photoCount', { count: (item.attachments || []).length })}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>{item.title}</h4>
                    <div className="text-xs" style={{ color: '#606060' }}>{getVideoSpeakerDisplayName(item)}</div>
                    <div className="text-xs" style={{ color: '#606060' }}>{dayjs(item.created_at).fromNow()}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const renderDocuments = () => {
    const docs = (content.attachments || []).filter((a) => a.type === 'document')
    if (docs.length === 0) return null

    return (
      <div className="mt-4 p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
        <h3 className="text-base font-medium mb-3" style={{ color: '#0f0f0f' }}>{t('content:download')}</h3>
        <div className="space-y-2">
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              style={{ border: '1px solid #e5e5e5' }}
            >
              <FileText size={20} style={{ color: '#909090' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: '#0f0f0f' }}>
                  {doc.title || doc.filename}
                </div>
                <div className="text-xs" style={{ color: '#909090' }}>
                  {doc.filename} • {formatFileSize(doc.file_size)}
                </div>
              </div>
              <Download size={16} style={{ color: '#909090' }} />
            </a>
          ))}
        </div>
      </div>
    )
  }

  const draftBanner = isDraft ? (
    <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
      {t('common:draftBanner')}
    </div>
  ) : null

  return (
    <div className={`flex gap-6 p-6 ${theaterMode ? '' : 'justify-center'}`}>
      <div style={{ width: theaterMode ? '100%' : 'max(640px, min(calc((100vh - 180px) * 16 / 9), calc(100vw - 48px)))' }}>
        {draftBanner}
        {currentVideo ? (
          <div className={`relative bg-black overflow-hidden ${theaterMode ? 'rounded-none' : 'rounded-xl'}`} style={{ width: '100%', aspectRatio: '16/9' }}>
            <VideoPlayer
              key={currentVideo.id}
              src={currentVideo.url}
              poster={getContentCover(content, siteConfig)}
              autoplay={autoplay}
              theaterMode={theaterMode}
              onToggleTheater={() => setTheaterMode(!theaterMode)}
              contentId={`${content.id}_${currentVideoIndex}`}
              hasPlaylist={videoItems.length > 1}
              onPrev={() => setCurrentVideoIndex(currentVideoIndex - 1, true)}
              onNext={() => setCurrentVideoIndex(currentVideoIndex + 1, true)}
              hasPrev={currentVideoIndex > 0}
              hasNext={currentVideoIndex < videoItems.length - 1}
            />
          </div>
        ) : (
          <div className={`relative overflow-hidden bg-zinc-100 ${theaterMode ? 'rounded-none' : 'rounded-xl'}`} style={{ width: '100%', aspectRatio: '16/9' }}>
            <img src={getContentCover(content, siteConfig)} alt={content.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Playlist below player on small screens (no sidebar) */}
        <div className="xl:hidden mt-3">
          {renderPlaylist()}
        </div>

        <h1 className="text-xl font-medium mt-4 mb-3" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>
          {content.title}
          {videoItems.length > 1 && currentVideo && (
            <span className="font-normal ml-2" style={{ color: '#606060' }}>— {currentVideo.title || `${t('common:video')} ${currentVideoIndex + 1}`}</span>
          )}
        </h1>
        {renderActions()}
        {renderDescription()}
        {renderDocuments()}
        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} highlightedCommentID={highlightedCommentID} />
        </div>
      </div>
      {!theaterMode && renderSidebar()}
    </div>
  )
}

export default VideoDetail
