import { useState, useCallback, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark, Mic } from 'lucide-react'
import dayjs from 'dayjs'
import { marked } from 'marked'
import { useTranslation } from 'react-i18next'

import { fileURL } from 'src/api/upload'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getContentCover } from 'src/lib/content-assets'
import { enhanceExternalLinks, formatFileSize } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import useContentDetail from 'src/hooks/useContentDetail'
import { AudioPlayer } from 'src/components/AudioPlayer'
import CommentSection from 'src/components/CommentSection'
import ShareButton from 'src/components/ShareButton'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'

// PodcastDetail displays a single podcast content item.
function PodcastDetail() {
  const { t } = useTranslation(['content', 'common'])
  const [searchParams, setSearchParams] = useSearchParams()
  const { siteConfig } = useAppContext()

  const {
    content, relatedContents, loading, error,
    liked, likeCount, favorited, favoriteCount, commentCount, setCommentCount,
    highlightedCommentID, highlightedContent,
    handleLike, handleFavorite,
    isDraft, canEdit, categoryLabel,
  } = useContentDetail({ expectedType: 'podcast', relatedLimit: 12 })

  const [theaterMode, setTheaterMode] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  // Derive currentPodcastIndex from URL search param ?p=N
  const pParam = searchParams.get('p')
  const currentPodcastIndex = pParam !== null ? parseInt(pParam, 10) || 0 : 0

  const setCurrentPodcastIndex = useCallback((index: number) => {
    const params: Record<string, string> = index === 0 ? {} : { p: String(index) }
    setSearchParams(params, { replace: true })
  }, [setSearchParams])

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#909090' }}>{t('common:loading')}</div>
  }

  if (error || !content) {
    return (
      <div className="text-center py-20">
        <div className="text-lg mb-4" style={{ color: '#909090' }}>{t('content:notFound')}</div>
        <Link to="/" className="text-sm underline" style={{ color: '#0f0f0f' }}>{t('content:backToHome')}</Link>
      </div>
    )
  }

  const coverUrl = getContentCover(content, siteConfig)
  const audioAttachments = (content.attachments || []).filter((a) => a.type === 'audio')
  const currentAudio = audioAttachments[currentPodcastIndex] || audioAttachments[0]

  // Speaker takes priority over author for display
  const speakerName = content.speaker?.name || content.speaker_name || content.author?.name || ''
  const speakerAvatar = content.speaker?.avatar || content.author?.avatar || ''
  const speakerUsername = content.speaker?.username || content.author?.username || ''

  const summaryHtml = content.summary
    ? enhanceExternalLinks(marked.parse(content.summary, { async: false }) as string)
    : ''

  const handleDescriptionClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null
    if (descExpanded || target?.closest('a')) return
    setDescExpanded(true)
  }

  const renderRelatedPodcasts = () => {
    if (relatedContents.length === 0) return null

    return (
      <>
        <div className="text-sm font-medium mb-3" style={{ color: '#0f0f0f' }}>{t('content:relatedPodcasts')}</div>
        <div className="space-y-3">
          {relatedContents.map((related) => (
            <Link
              key={related.id}
              to={contentDetailPath(related)}
              className="flex gap-2 no-underline group"
              style={{ color: 'inherit' }}
            >
              <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100" style={{ width: 168, aspectRatio: '16/9' }}>
                <img
                  src={getContentCover(related, siteConfig) || ''}
                  alt={related.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-1 right-1 px-1 rounded text-xs" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                  {t('common:podcast')}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>{related.title}</h4>
                <div className="text-xs" style={{ color: '#606060' }}>
                  {related.speaker?.name || related.speaker_name || related.author?.name || t('common:unknownAuthor')}
                </div>
                <div className="text-xs" style={{ color: '#606060' }}>{dayjs(related.created_at).fromNow()}</div>
              </div>
            </Link>
          ))}
        </div>
      </>
    )
  }

  const renderSidebar = () => {
    if (relatedContents.length === 0) return null

    return (
      <div className="hidden xl:block flex-shrink-0 w-[400px]">
        {renderRelatedPodcasts()}
      </div>
    )
  }

  return (
    <div className={`flex gap-6 p-6 ${theaterMode ? '' : 'justify-center'}`}>
      <div style={{ width: theaterMode ? '100%' : 'max(640px, min(calc((100vh - 180px) * 16 / 9), calc(100vw - 48px)))' }}>

        {/* Draft banner */}
        {isDraft && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
            {t('common:draftBanner')}
          </div>
        )}

        {/* Audio Player — video-style, cover inside */}
        {currentAudio && (
          <div className="mb-6">
            <AudioPlayer
              src={fileURL(currentAudio.url)}
              coverUrl={coverUrl || undefined}
              title={content.title}
              theaterMode={theaterMode}
              onToggleTheater={() => setTheaterMode(!theaterMode)}
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>{content.title}</h1>

        {/* Speaker + actions row */}
        <div className="flex items-center justify-between pb-4 mb-0" style={{ borderBottom: '1px solid #e5e5e5' }}>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <SiteAvatarImage src={speakerAvatar} alt={speakerName} />
              <AvatarFallback>{speakerName.charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
            </Avatar>
            <div>
              {speakerUsername ? (
                <Link to={`/@${speakerUsername}`} className="no-underline">
                  <div className="text-sm font-medium hover:underline" style={{ color: '#0f0f0f' }}>{speakerName}</div>
                </Link>
              ) : (
                <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>{speakerName}</div>
              )}
              <div className="text-xs" style={{ color: '#606060' }}>
                {dayjs(content.created_at).fromNow()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLike}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{
                background: liked ? 'rgba(6,95,212,0.1)' : 'rgba(0,0,0,0.05)',
                color: liked ? '#065fd4' : '#0f0f0f',
                boxShadow: highlightedContent ? 'inset 0 0 0 1px rgba(6,95,212,0.28)' : undefined,
              }}
            >
              <ThumbsUp size={18} fill={liked ? 'currentColor' : 'none'} />
              <span>{likeCount}</span>
            </button>
            <button
              onClick={handleFavorite}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{ background: favorited ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.05)', color: favorited ? '#b45309' : '#0f0f0f' }}
            >
              <Bookmark size={18} fill={favorited ? 'currentColor' : 'none'} />
              <span>{favoriteCount}</span>
            </button>
            <a href="#comments" className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
              <MessageCircle size={18} />
              <span>{commentCount}</span>
            </a>
            <ShareButton
              title={content.title}
              text={content.summary || undefined}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}
            />
            {canEdit && (
              <Link
                to={contentEditPath(content)}
                className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline"
                style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}
              >
                <Pencil size={16} />
                <span>{t('common:edit')}</span>
              </Link>
            )}
          </div>
        </div>

        {/* Description — same style as video page */}
        <div className="mt-4 mb-6 p-3 rounded-xl text-sm" style={{ background: 'rgba(0,0,0,0.03)', color: '#0f0f0f' }}>
          <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: '#606060' }}>
            <span>{categoryLabel}</span>
            {content.tags?.length > 0 && (
              <>
                <span>•</span>
                <span>{content.tags.join(', ')}</span>
              </>
            )}
          </div>
          {summaryHtml && (
            <div
              className={`rich-content prose prose-sm max-w-none ${descExpanded ? '' : 'line-clamp-3'}`}
              style={{ color: '#292929', lineHeight: 1.75, cursor: descExpanded ? 'auto' : 'pointer' }}
              onClick={handleDescriptionClick}
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          )}
          {(speakerName || content.speaker_bio) && (
            <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <span className="font-medium">{t('content:speaker')}</span>
              {speakerName}
              {content.speaker_bio && <span className="ml-2" style={{ color: '#606060' }}>- {content.speaker_bio}</span>}
            </div>
          )}
          {(summaryHtml || content.speaker_bio) && (
            <button className="mt-2 text-sm font-medium" style={{ color: '#065fd4' }} onClick={() => setDescExpanded(!descExpanded)}>
              {descExpanded ? t('content:collapse') : t('content:expand')}
            </button>
          )}
        </div>
        {/* Episode list (multiple audio files) */}
        {audioAttachments.length > 1 && (
          <div className="mb-6 rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
            <div className="px-4 py-2.5 text-sm font-medium" style={{ background: '#f9f9f9', color: '#0f0f0f', borderBottom: '1px solid #e5e5e5' }}>
              {t('content:episodes')}
            </div>
            <div>
              {audioAttachments.map((audio, index) => (
                <button
                  key={audio.id}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer"
                  style={{
                    background: index === currentPodcastIndex ? 'rgba(0,0,0,0.04)' : 'transparent',
                    borderTop: index > 0 ? '1px solid #f2f2f2' : 'none',
                  }}
                  onClick={() => setCurrentPodcastIndex(index)}
                >
                  <Mic size={16} style={{ color: index === currentPodcastIndex ? '#065fd4' : '#909090', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: '#0f0f0f', fontWeight: index === currentPodcastIndex ? 600 : 400 }}>
                      {audio.title || audio.filename}
                    </div>
                    {audio.file_size > 0 && (
                      <div className="text-xs" style={{ color: '#909090' }}>{formatFileSize(audio.file_size)}</div>
                    )}
                  </div>
                  {index === currentPodcastIndex && (
                    <span className="text-xs font-medium" style={{ color: '#065fd4' }}>{t('content:playing')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} highlightedCommentID={highlightedCommentID} />
        </div>

        <div className="xl:hidden mt-12">
          {renderRelatedPodcasts()}
        </div>

      </div>
      {!theaterMode && renderSidebar()}
    </div>
  )
}

export default PodcastDetail
