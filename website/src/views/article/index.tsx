import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { ThumbsUp, MessageCircle, Pencil, Bookmark, Download, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { getContent, toggleLike, favoriteContent } from 'src/api/content'
import { recordContentView } from 'src/api/view'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { formatFileSize } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import CommentSection from 'src/components/CommentSection'
import ShareButton from 'src/components/ShareButton'
import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { Content } from 'src/types/content'

// ArticleDetail displays a single article content item in a Medium-style layout.
function ArticleDetail() {
  const { t } = useTranslation(['content', 'common'])
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser } = useAppContext()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        if (res.data.type !== 'article') {
          navigate(contentDetailPath(res.data), { replace: true })
          return
        }
        setContent(res.data)
        setLiked(!!res.data.liked)
        setLikeCount(res.data.like_count || 0)
        setFavorited(!!res.data.favorited)
        setFavoriteCount(res.data.favorite_count || 0)
        setCommentCount(res.data.comment_count || 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!currentUser || !content?.id) return

    const timer = window.setTimeout(() => {
      recordContentView(content.id, { trigger: 'detail' }).catch(() => {})
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [content?.id, currentUser])

  if (loading) {
    return <div className="app-text-secondary p-6 text-center">{t('content:loading')}</div>
  }

  if (error || !content) {
    return <div className="app-text-secondary p-6 text-center">{t('content:notFound')}</div>
  }

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)
  const highlightedCommentID = searchParams.get('liked_comment') || undefined
  const highlightedContent = searchParams.get('liked_content') === '1'

  const renderDocuments = () => {
    const docs = (content.attachments || []).filter((a) => a.type === 'document')
    if (docs.length === 0) return null

    return (
      <div className="app-surface-elevated mb-8 p-4 rounded-xl border app-border">
        <h3 className="text-base font-medium mb-3 text-foreground">{t('content:download')}</h3>
        <div className="space-y-2">
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
              style={{ border: '1px solid var(--surface-border)' }}
            >
              <FileText size={20} style={{ color: 'var(--text-tertiary)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">
                  {doc.title || doc.filename}
                </div>
                <div className="app-text-tertiary text-xs">
                  {doc.filename} • {formatFileSize(doc.file_size)}
                </div>
              </div>
              <Download size={16} style={{ color: 'var(--text-tertiary)' }} />
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
    <div className="app-surface flex gap-6 p-6 justify-center">
      <div style={{ maxWidth: 840, width: '100%' }}>
        {draftBanner}
        <h1 className="text-3xl font-bold mb-4 text-foreground" style={{ lineHeight: 1.3 }}>{content.title}</h1>

        {/* Author info */}
        <div className="flex items-center gap-3 mb-6">
          <Avatar size="lg">
            <SiteAvatarImage src={content.speaker?.avatar || content.author?.avatar || ''} alt={content.speaker?.name || content.author?.name || t('common:anonymousUser')} />
            <AvatarFallback>{content.speaker?.name?.charAt(0) || content.author?.name?.charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium text-foreground">
              {content.speaker?.name || content.author?.name || content.speaker_name || t('common:unknownAuthor')}
            </div>
            <div className="app-text-secondary text-xs">
              {dayjs(content.created_at).format(t('content:articleDate'))}
              {content.speaker_bio && <span> · {content.speaker_bio}</span>}
            </div>
          </div>
        </div>

        {/* Cover image */}
        {content.cover_url && (
          <div className="mb-8 rounded-xl overflow-hidden">
            <img src={content.cover_url} alt={content.title} className="w-full object-cover" style={{ maxHeight: 400 }} />
          </div>
        )}

        {/* Body */}
        {content.body && (
          <div
            className="rich-content mb-8"
            style={{ color: 'var(--article-body)', lineHeight: 1.8, fontSize: '18px' }}
            dangerouslySetInnerHTML={{ __html: content.body }}
          />
        )}

        {/* Document Attachments */}
        {renderDocuments()}

        {/* Tags */}
        {content.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {content.tags.map((tag) => (
              <span key={tag} className="app-surface-muted app-text-secondary px-3 py-1 rounded-full text-sm">{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="py-4 border-y app-border">
          <div className="flex items-center gap-3">
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
              text={content.summary || content.speaker_bio || undefined}
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

        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} highlightedCommentID={highlightedCommentID} />
        </div>
      </div>
    </div>
  )
}

export default ArticleDetail
