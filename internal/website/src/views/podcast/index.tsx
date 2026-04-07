import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark, Mic } from 'lucide-react'
import dayjs from 'dayjs'
import { marked } from 'marked'
import { useTranslation } from 'react-i18next'

import { getContent, listContents, toggleLike, favoriteContent } from 'src/api/content'
import { fileURL } from 'src/api/upload'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getContentCover } from 'src/lib/content-assets'
import { formatFileSize } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import { AudioPlayer } from 'src/components/AudioPlayer'
import CommentSection from 'src/components/CommentSection'
import ShareButton from 'src/components/ShareButton'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { Content } from 'src/types/content'

// PodcastDetail displays a single podcast content item.
function PodcastDetail() {
  const { t } = useTranslation(['content', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentUser, categories, siteConfig } = useAppContext()
  const [content, setContent] = useState<Content | null>(null)
  const [relatedContents, setRelatedContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  // Derive currentPodcastIndex from URL search param ?p=N
  const pParam = searchParams.get('p')
  const currentPodcastIndex = pParam !== null ? parseInt(pParam, 10) || 0 : 0

  const setCurrentPodcastIndex = useCallback((index: number) => {
    const params: Record<string, string> = index === 0 ? {} : { p: String(index) }
    setSearchParams(params, { replace: true })
  }, [setSearchParams])

  // Load content
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        const data = res.data
        if (data.type !== 'podcast') {
          navigate(contentDetailPath(data), { replace: true })
          return
        }
        setContent(data)
        setLiked(data.liked ?? false)
        setLikeCount(data.like_count ?? 0)
        setFavorited(data.favorited ?? false)
        setFavoriteCount(data.favorite_count ?? 0)
        setCommentCount(data.comment_count ?? 0)
        setError(false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, navigate])

  // Load related podcasts (exclude current)
  useEffect(() => {
    if (!content || !content.category) return
    listContents({ type: 'podcast', category: content.category, limit: 12 })
      .then((res) => setRelatedContents((res.data.items || []).filter((c) => c.id !== content.id)))
      .catch(() => {})
  }, [content])

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

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)
  const category = categories ? categories.find((c) => c.id === content.category) : null
  const coverUrl = getContentCover(content, siteConfig)
  const audioAttachments = (content.attachments || []).filter((a) => a.type === 'audio')
  const currentAudio = audioAttachments[currentPodcastIndex] || audioAttachments[0]

  // Speaker takes priority over author for display
  const speakerName = content.speaker?.name || content.speaker_name || content.author?.name || ''
  const speakerAvatar = content.speaker?.avatar || content.author?.avatar || ''
  const speakerUsername = content.speaker?.username || content.author?.username || ''

  const summaryHtml = content.summary
    ? marked.parse(content.summary, { async: false }) as string
    : ''

  const handleLike = () => {
    if (!currentUser) return
    toggleLike('content', content.id).then((res) => {
      setLiked(res.data.liked ?? false)
      setLikeCount(res.data.like_count ?? 0)
    })
  }

  const handleFavorite = () => {
    if (!currentUser) return
    favoriteContent(content.id).then((res) => {
      setFavorited(res.data.favorited ?? false)
      setFavoriteCount(res.data.favorite_count ?? 0)
    })
  }

  return (
    <div className="flex justify-center px-4 py-6">
      <div style={{ width: '100%', maxWidth: 840 }}>

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
              downloadUrl={fileURL(currentAudio.url)}
              downloadFilename={currentAudio.filename}
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold mb-4" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>{content.title}</h1>

        {/* Speaker + actions row */}
        <div className="flex items-center justify-between pb-4 mb-6" style={{ borderBottom: '1px solid #e5e5e5' }}>
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
              <div className="text-xs flex items-center gap-1.5" style={{ color: '#606060' }}>
                <span>{dayjs(content.created_at).fromNow()}</span>
                {category && (
                  <>
                    <span>·</span>
                    <Link to={`/${category.slug}`} className="no-underline hover:underline" style={{ color: '#606060' }}>{category.name}</Link>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLike}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{ background: liked ? 'rgba(6,95,212,0.1)' : 'rgba(0,0,0,0.05)', color: liked ? '#065fd4' : '#0f0f0f' }}
              disabled={!currentUser}
            >
              <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
              <span>{likeCount}</span>
            </button>
            <button
              onClick={handleFavorite}
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{ background: favorited ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.05)', color: favorited ? '#b45309' : '#0f0f0f' }}
              disabled={!currentUser}
            >
              <Bookmark size={16} fill={favorited ? 'currentColor' : 'none'} />
              <span>{favoriteCount}</span>
            </button>
            <a href="#comments" className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
              <MessageCircle size={16} />
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

        {/* Description — Markdown rendered, fully visible, followed by a divider */}
        {summaryHtml && (
          <div className="mb-8">
            <div
              className="rich-content prose prose-sm max-w-none"
              style={{ color: '#292929', lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
            <div className="mt-6" style={{ borderTop: '1px solid #e5e5e5' }} />
          </div>
        )}

        {/* Comments */}
        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} />
        </div>

        {/* Related Podcasts — only shown when results exist */}
        {relatedContents.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-semibold mb-5" style={{ color: '#0f0f0f' }}>{t('content:relatedPodcasts')}</h3>
            <div className="space-y-3">
              {relatedContents.map((related) => (
                <Link
                  key={related.id}
                  to={contentDetailPath(related)}
                  className="flex gap-3 no-underline group"
                  style={{ color: 'inherit' }}
                >
                  <div className="flex-shrink-0 rounded-xl overflow-hidden bg-zinc-100" style={{ width: 64, height: 64 }}>
                    <img
                      src={getContentCover(related, siteConfig) || ''}
                      alt={related.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>{related.title}</h4>
                    <div className="text-xs" style={{ color: '#606060' }}>
                      {(related.speaker?.name || related.speaker_name || related.author?.name) && (
                        <span>{related.speaker?.name || related.speaker_name || related.author?.name} · </span>
                      )}
                      <span>{dayjs(related.created_at).format('YYYY-MM-DD')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default PodcastDetail
