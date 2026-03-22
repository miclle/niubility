import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ThumbsUp, Share2, MessageCircle, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { getContent, likeContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { useAppContext } from 'src/context/app'
import CommentSection from 'src/components/CommentSection'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// ArticleDetail displays a single article content item in a Medium-style layout.
function ArticleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentUser } = useAppContext()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
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
        setCommentCount(res.data.comment_count || 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>加载中...</div>
  }

  if (error || !content) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>内容不存在</div>
  }

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)

  const draftBanner = isDraft ? (
    <div className="mb-4 px-4 py-3 rounded-xl text-sm font-medium" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
      草稿预览 — 此内容尚未发布，仅作者可见
    </div>
  ) : null

  return (
    <div className="flex gap-6 p-6 justify-center">
      <div style={{ maxWidth: 840, width: '100%' }}>
        {draftBanner}
        <h1 className="text-3xl font-bold mb-4" style={{ color: '#0f0f0f', lineHeight: 1.3 }}>{content.title}</h1>

        {/* Author info */}
        <div className="flex items-center gap-3 mb-6">
          <Avatar size="lg">
            <AvatarImage src={content.speaker?.avatar || content.author?.avatar || ''} alt={content.speaker?.name || content.author?.name || '匿名'} />
            <AvatarFallback>{content.speaker?.name?.charAt(0) || content.author?.name?.charAt(0) || '匿'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
              {content.speaker?.name || content.author?.name || content.speaker_name || '未知作者'}
            </div>
            <div className="text-xs" style={{ color: '#606060' }}>
              {dayjs(content.created_at).format('YYYY 年 M 月 D 日')}
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
            className="prose prose-lg max-w-none mb-8"
            style={{ color: '#292929', lineHeight: 1.8, fontSize: '18px' }}
            dangerouslySetInnerHTML={{ __html: content.body }}
          />
        )}

        {/* Tags */}
        {content.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {content.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full text-sm" style={{ background: '#f2f2f2', color: '#606060' }}>{tag}</span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="py-4" style={{ borderTop: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5' }}>
          <div className="flex items-center gap-3">
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

        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} />
        </div>
      </div>
    </div>
  )
}

export default ArticleDetail
