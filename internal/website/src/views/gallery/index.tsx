import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { ThumbsUp, Share2, MessageCircle, Pencil, Bookmark } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { getContent, likeContent, favoriteContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { useAppContext } from 'src/context/app'
import JustifiedGrid from 'src/components/JustifiedGrid'
import Lightbox from 'src/components/Lightbox'
import CommentSection from 'src/components/CommentSection'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// GalleryDetail displays a single gallery (image) content item with justified grid and lightbox.
function GalleryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser, categories } = useAppContext()
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
    return <div className="p-6 text-center" style={{ color: '#606060' }}>加载中...</div>
  }

  if (error || !content) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>内容不存在</div>
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
          草稿预览 — 此内容尚未发布，仅作者可见
        </div>
      )}

      {/* Title */}
      <h1 className="text-xl font-medium mb-3" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>{content.title}</h1>

      {/* Author info + actions */}
      <div className="flex items-center justify-between pb-4 mb-4" style={{ borderBottom: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarImage src={content.speaker?.avatar || content.author?.avatar || ''} alt={content.speaker?.name || content.author?.name || content.speaker_name || '匿名'} />
            <AvatarFallback>{content.speaker?.name?.charAt(0) || content.author?.name?.charAt(0) || content.speaker_name?.charAt(0) || '匿'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
              {content.speaker?.name || content.author?.name || content.speaker_name || '未知作者'}
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
              likeContent(content.id).then((res) => { setLiked(res.data.liked); setLikeCount(res.data.like_count) })
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
          <button className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
            <Share2 size={18} />
            <span>分享</span>
          </button>
          {canEdit && (
            <Link to={contentEditPath(content)} className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline" style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}>
              <Pencil size={16} />
              <span>编辑</span>
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
