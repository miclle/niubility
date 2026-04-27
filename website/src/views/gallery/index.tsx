import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { getContent, toggleLike, favoriteContent } from 'src/api/content'
import { recordContentView } from 'src/api/view'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getSpeakerAvatar, getSpeakerDisplayName } from 'src/lib/content-assets'
import { useAppContext } from 'src/context/app'
import JustifiedGrid from 'src/components/JustifiedGrid'
import Lightbox from 'src/components/Lightbox'
import CommentSection from 'src/components/CommentSection'
import ShareButton from 'src/components/ShareButton'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { Content } from 'src/types/content'

// GalleryDetail displays a single gallery (image) content item with justified grid and lightbox.
function GalleryDetail() {
  const { t } = useTranslation(['content', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser, categories, siteConfig } = useAppContext()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [likedAttachmentIds, setLikedAttachmentIds] = useState<Set<string>>(new Set())
  const highlightedCommentID = searchParams.get('liked_comment') || undefined
  const highlightedAttachmentID = searchParams.get('liked_attachment') || undefined
  const highlightedContent = searchParams.get('liked_content') === '1'

  // Parse hash to restore lightbox state on load / hash change
  useEffect(() => {
    const match = location.hash.match(/^#photo=(\d+)$/)
    if (match) {
      setLightboxIndex(parseInt(match[1], 10))
      setLightboxOpen(true)
    } else {
      setLightboxOpen(false)
    }
  }, [location.hash])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        if (res.data.type !== 'gallery') {
          navigate(contentDetailPath(res.data), { replace: true })
          return
        }
        setContent(res.data)
        setLiked(!!res.data.liked)
        setLikeCount(res.data.like_count || 0)
        setFavorited(!!res.data.favorited)
        setFavoriteCount(res.data.favorite_count || 0)
        setCommentCount(res.data.comment_count || 0)
        setLikedAttachmentIds(new Set(res.data.liked_attachment_ids || []))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!content || !highlightedAttachmentID) return
    const index = (content.attachments || []).findIndex((attachment) => attachment.id === highlightedAttachmentID)
    if (index < 0) return
    setLightboxIndex(index)
    setLightboxOpen(true)
  }, [content, highlightedAttachmentID])

  useEffect(() => {
    if (!currentUser || !content?.id) return

    const timer = window.setTimeout(() => {
      recordContentView(content.id, { trigger: 'detail' }).catch(() => {})
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [content?.id, currentUser])

  const handleImageClick = useCallback((index: number) => {
    window.location.hash = `photo=${index}`
  }, [])

  const handleLightboxClose = useCallback(() => {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setLightboxOpen(false)
  }, [])

  const handleLightboxIndexChange = useCallback((index: number) => {
    window.location.hash = `photo=${index}`
  }, [])

  const handleAttachmentLikeChange = useCallback((attachmentId: string, liked: boolean, likeCount: number) => {
    setLikedAttachmentIds((prev) => {
      const next = new Set(prev)
      if (liked) next.add(attachmentId)
      else next.delete(attachmentId)
      return next
    })
    // Update attachment like_count in content state
    setContent((prev) => {
      if (!prev || !prev.attachments) return prev
      return {
        ...prev,
        attachments: prev.attachments.map((a) => a.id === attachmentId ? { ...a, like_count: likeCount } : a),
      }
    })
  }, [])

  if (loading) {
    return <div className="app-text-secondary p-6 text-center">{t('content:loading')}</div>
  }

  if (error || !content) {
    return <div className="app-text-secondary p-6 text-center">{t('content:notFound')}</div>
  }

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)
  const categoryLabel = categories.find((c) => c.slug === content.category)?.name || content.category
  const galleryItems = content.attachments || []

  return (
    <div className="app-surface max-w-[1200px] mx-auto px-6 py-6">
      {/* Draft banner */}
      {isDraft && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
          {t('common:draftBanner')}
        </div>
      )}

      {/* Title */}
      <h1 className="text-xl font-medium mb-3 text-foreground" style={{ lineHeight: 1.4 }}>{content.title}</h1>

      {/* Author info + actions */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b app-border">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <SiteAvatarImage src={getSpeakerAvatar(content, siteConfig)} alt={getSpeakerDisplayName(content)} />
            <AvatarFallback>{getSpeakerDisplayName(content).charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-foreground">
              {getSpeakerDisplayName(content)}
            </div>
            <div className="app-text-secondary text-xs">
              {dayjs(content.created_at).fromNow()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
            style={{
              background: liked ? 'var(--brand-soft)' : 'var(--surface-hover)',
              color: liked ? 'var(--brand)' : 'var(--foreground)',
              boxShadow: highlightedContent ? 'inset 0 0 0 1px color-mix(in srgb, var(--brand) 40%, transparent)' : undefined,
            }}
            onClick={() => {
              toggleLike('content', content.id).then((res) => { setLiked(res.data.liked); setLikeCount(res.data.like_count) })
            }}
          >
            <ThumbsUp size={18} fill={liked ? 'currentColor' : 'none'} />
            <span>{likeCount || 0}</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
            style={{ background: favorited ? 'color-mix(in srgb, #f59e0b 18%, transparent)' : 'var(--surface-hover)', color: favorited ? '#b45309' : 'var(--foreground)' }}
            onClick={() => {
              favoriteContent(content.id).then((res) => { setFavorited(res.data.favorited); setFavoriteCount(res.data.favorite_count) })
            }}
          >
            <Bookmark size={18} fill={favorited ? 'currentColor' : 'none'} />
            <span>{favoriteCount || 0}</span>
          </button>
          <a href="#comments" className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}>
            <MessageCircle size={18} />
            <span>{commentCount || 0}</span>
          </a>
          <ShareButton
            title={content.title}
            text={content.summary || undefined}
            className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}
          />
          {canEdit && (
            <Link to={contentEditPath(content)} className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'var(--surface-hover)', color: 'var(--foreground)' }}>
              <Pencil size={16} />
              <span>{t('common:edit')}</span>
            </Link>
          )}
        </div>
      </div>
      {galleryItems.length > 0 && (
        <JustifiedGrid items={galleryItems} onImageClick={handleImageClick} highlightedAttachmentID={highlightedAttachmentID} />
      )}

      {/* Description & tags */}
      {content.summary && (
        <div className="app-surface-muted mt-6 p-3 rounded-xl text-sm whitespace-pre-wrap text-foreground">
          <div className="app-text-secondary flex items-center gap-2 mb-2 text-xs">
            <span>{categoryLabel}</span>
            {content.tags?.length > 0 && (
              <>
                <span>·</span>
                <span>{content.tags.join(', ')}</span>
              </>
            )}
          </div>
          {content.summary}
        </div>
      )}

      {/* Comments */}
      <div id="comments">
        <CommentSection
          contentID={content.id}
          commentCount={commentCount}
          onCommentCountChange={setCommentCount}
          highlightedCommentID={highlightedAttachmentID ? undefined : highlightedCommentID}
        />
      </div>

      {/* Lightbox */}
      <Lightbox
        items={galleryItems}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={handleLightboxClose}
        onIndexChange={handleLightboxIndexChange}
        contentId={content.id}
        commentCount={commentCount}
        onCommentCountChange={setCommentCount}
        likedAttachmentIds={likedAttachmentIds}
        onAttachmentLikeChange={handleAttachmentLikeChange}
        initialInfoPanelOpen={!!highlightedAttachmentID}
        highlightedCommentID={highlightedCommentID}
        highlightedAttachmentID={highlightedAttachmentID}
      />
    </div>
  )
}

export default GalleryDetail
