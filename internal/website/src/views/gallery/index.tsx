import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { getContent, toggleLike, favoriteContent } from 'src/api/content'
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
    return <div className="p-6 text-center" style={{ color: '#606060' }}>{t('content:loading')}</div>
  }

  if (error || !content) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>{t('content:notFound')}</div>
  }

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)
  const categoryLabel = categories.find((c) => c.slug === content.category)?.name || content.category
  const galleryItems = content.attachments || []

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      {/* Draft banner */}
      {isDraft && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
          {t('common:draftBanner')}
        </div>
      )}

      {/* Title */}
      <h1 className="text-xl font-medium mb-3" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>{content.title}</h1>

      {/* Author info + actions */}
      <div className="flex items-center justify-between pb-4 mb-4" style={{ borderBottom: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <SiteAvatarImage src={getSpeakerAvatar(content, siteConfig)} alt={getSpeakerDisplayName(content)} />
            <AvatarFallback>{getSpeakerDisplayName(content).charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
              {getSpeakerDisplayName(content)}
            </div>
            <div className="text-xs" style={{ color: '#606060' }}>
              {dayjs(content.created_at).fromNow()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
            style={{ background: liked ? 'rgba(6,95,212,0.1)' : 'rgba(0,0,0,0.05)', color: liked ? '#065fd4' : '#0f0f0f' }}
            onClick={() => {
              toggleLike('content', content.id).then((res) => { setLiked(res.data.liked); setLikeCount(res.data.like_count) })
            }}
          >
            <ThumbsUp size={18} fill={liked ? 'currentColor' : 'none'} />
            <span>{likeCount || 0}</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
            style={{ background: favorited ? 'rgba(234,179,8,0.1)' : 'rgba(0,0,0,0.05)', color: favorited ? '#b45309' : '#0f0f0f' }}
            onClick={() => {
              favoriteContent(content.id).then((res) => { setFavorited(res.data.favorited); setFavoriteCount(res.data.favorite_count) })
            }}
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
            text={content.summary || undefined}
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
      {galleryItems.length > 0 && (
        <JustifiedGrid items={galleryItems} onImageClick={handleImageClick} />
      )}

      {/* Description & tags */}
      {content.summary && (
        <div className="mt-6 p-3 rounded-xl text-sm whitespace-pre-wrap" style={{ background: 'rgba(0,0,0,0.03)', color: '#0f0f0f' }}>
          <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: '#606060' }}>
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
        <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} />
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
      />
    </div>
  )
}

export default GalleryDetail
