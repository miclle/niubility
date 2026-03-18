import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ThumbsUp, Share2, ArrowLeft, MessageCircle } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { getContent, listContents, likeContent } from 'src/api/content'
import { fileURL } from 'src/api/upload'
import VideoPlayer from 'src/components/VideoPlayer'
import CommentSection from 'src/components/CommentSection'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// ContentDetail displays a single content item in YouTube watch page style.
function ContentDetail() {
  const { id } = useParams<{ id: string }>()
  const [content, setContent] = useState<Content | null>(null)
  const [relatedContents, setRelatedContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [theaterMode, setTheaterMode] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  // Fetch main content
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        setContent(res.data)
        setLiked(!!res.data.liked)
        setLikeCount(res.data.like_count || 0)
        setCommentCount(res.data.comment_count || 0)
        // Fetch related contents from same category
        return listContents({
          category: res.data.category,
          limit: 10,
        })
      })
      .then((res) => {
        // Filter out current content
        setRelatedContents((res.data.contents || []).filter((c) => c.id !== id))
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

  const categoryPath = content.category === 'culture' ? '/culture' : '/learning'
  const categoryLabel = content.category === 'culture' ? '七牛文化' : '学习分享'

  return (
    <div className={`flex gap-6 p-6 ${theaterMode ? '' : 'justify-center'}`}>
      {/* Main content area */}
      <div style={{ width: theaterMode ? '100%' : 'max(640px, min(calc((100vh - 180px) * 16 / 9), calc(100vw - 48px)))' }}>
        {/* Video / Cover player */}
        {content.type === 'video' && content.video_url ? (
          <div
            className={`relative bg-black overflow-hidden ${theaterMode ? 'rounded-none' : 'rounded-xl'}`}
            style={{ width: '100%', aspectRatio: '16/9' }}
          >
            <VideoPlayer
              src={fileURL(content.video_url)}
              poster={fileURL(content.cover_url) || '/default-cover.svg'}
              theaterMode={theaterMode}
              onToggleTheater={() => setTheaterMode(!theaterMode)}
              contentId={content.id}
            />
          </div>
        ) : (
          <div
            className={`relative overflow-hidden bg-zinc-100 ${theaterMode ? 'rounded-none' : 'rounded-xl'}`}
            style={{ width: '100%', aspectRatio: '16/9' }}
          >
            <img
              src={fileURL(content.cover_url) || '/default-cover.svg'}
              alt={content.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-xl font-medium mt-4 mb-3" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>
          {content.title}
        </h1>

        {/* Channel info and actions */}
        <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid #e5e5e5' }}>
          {/* Channel info */}
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarImage src={content.speaker?.avatar || content.author?.avatar} alt={content.speaker?.name || content.author?.name || content.speaker_name || '匿名'} />
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

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{
                background: liked ? 'rgba(6,95,212,0.1)' : 'rgba(0,0,0,0.05)',
                color: liked ? '#065fd4' : '#0f0f0f',
              }}
              onClick={() => {
                likeContent(content.id).then((res) => {
                  setLiked(res.data.liked)
                  setLikeCount(res.data.like_count)
                })
              }}
            >
              <ThumbsUp size={18} fill={liked ? 'currentColor' : 'none'} />
              <span>{likeCount || 0}</span>
            </button>
            <a
              href="#comments"
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors no-underline"
              style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}
            >
              <MessageCircle size={18} />
              <span>{commentCount || 0}</span>
            </a>
            <button
              className="flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium transition-colors"
              style={{ background: 'rgba(0,0,0,0.05)', color: '#0f0f0f' }}
            >
              <Share2 size={18} />
              <span>分享</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <div
          className="mt-4 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(0,0,0,0.03)', color: '#0f0f0f' }}
        >
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
            <div
              className={`whitespace-pre-wrap ${descExpanded ? '' : 'line-clamp-2'}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setDescExpanded(!descExpanded)}
            >
              {content.summary}
            </div>
          )}

          {(content.speaker_name || content.speaker) && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <span className="font-medium">主讲人：</span>
              {content.speaker?.name || content.speaker_name}
              {content.speaker_bio && <span className="ml-2" style={{ color: '#606060' }}>- {content.speaker_bio}</span>}
            </div>
          )}

          {content.body && (
            <div
              className={`mt-3 pt-3 prose-dark ${descExpanded ? '' : 'line-clamp-3'}`}
              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
              dangerouslySetInnerHTML={{ __html: content.body }}
            />
          )}

          {(content.summary || content.body) && (
            <button
              className="mt-2 text-sm font-medium"
              style={{ color: '#065fd4' }}
              onClick={() => setDescExpanded(!descExpanded)}
            >
              {descExpanded ? '收起' : '展开'}
            </button>
          )}
        </div>

        {/* Comment section */}
        <div id="comments">
          <CommentSection
            contentID={content.id}
            commentCount={commentCount}
            onCommentCountChange={setCommentCount}
          />
        </div>
      </div>

      {/* Sidebar - Related contents (hidden in theater mode) */}
      {!theaterMode && (
      <div className="hidden xl:block flex-shrink-0 w-[400px]">
        {/* Back to list */}
        <Link
          to={categoryPath}
          className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
          style={{ color: '#606060' }}
        >
          <ArrowLeft size={16} />
          返回{categoryLabel}
        </Link>

        {/* Related content list */}
        <div className="space-y-3">
          {relatedContents.map((item) => (
            <Link
              key={item.id}
              to={`/contents/${item.id}`}
              className="flex gap-2 no-underline group"
              style={{ color: 'inherit' }}
            >
              {/* Thumbnail */}
              <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100" style={{ width: 168, aspectRatio: '16/9' }}>
                <img
                  src={fileURL(item.cover_url) || '/default-cover.svg'}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                {item.type === 'video' && (
                  <div
                    className="absolute bottom-1 right-1 px-1 rounded text-xs"
                    style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}
                  >
                    视频
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>
                  {item.title}
                </h4>
                <div className="text-xs" style={{ color: '#606060' }}>
                  {item.author?.name || '未知作者'}
                </div>
                <div className="text-xs" style={{ color: '#606060' }}>
                  {dayjs(item.created_at).fromNow()}
                </div>
              </div>
            </Link>
          ))}

          {relatedContents.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#606060' }}>
              暂无相关内容
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  )
}

export default ContentDetail
