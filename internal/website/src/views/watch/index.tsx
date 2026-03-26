import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ThumbsUp, Share2, ArrowLeft, MessageCircle, Pencil, Bookmark, Download, FileText } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import { getContent, listContents, likeContent, favoriteContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { useAppContext } from 'src/context/app'
import VideoPlayer from 'src/components/VideoPlayer'
import CommentSection from 'src/components/CommentSection'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// formatFileSize formats a file size in bytes to a human-readable string.
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// getContentCover returns the best cover URL for a content item.
function getContentCover(content: Content): string {
  if (content.cover_url) return content.cover_url
  const coverItem = (content.attachments || []).find((m) => m.is_cover)
  if (coverItem) return coverItem.url
  const firstImage = (content.attachments || []).find((m) => m.type === 'image')
  if (firstImage) return firstImage.url
  return '/default-cover.svg'
}

// VideoDetail displays a single video content item.
function VideoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentUser } = useAppContext()
  const [content, setContent] = useState<Content | null>(null)
  const [relatedContents, setRelatedContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [theaterMode, setTheaterMode] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  // Derive currentVideoIndex from URL search param ?v=N
  const vParam = searchParams.get('v')
  const currentVideoIndex = vParam !== null ? parseInt(vParam, 10) || 0 : 0

  const setCurrentVideoIndex = useCallback((index: number) => {
    if (index === 0) {
      setSearchParams({}, { replace: true })
    } else {
      setSearchParams({ v: String(index) }, { replace: true })
    }
  }, [setSearchParams])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        // Redirect if type doesn't match this route
        if (res.data.type !== 'video') {
          navigate(contentDetailPath(res.data), { replace: true })
          return
        }
        setContent(res.data)
        setLiked(!!res.data.liked)
        setLikeCount(res.data.like_count || 0)
        setFavorited(!!res.data.favorited)
        setFavoriteCount(res.data.favorite_count || 0)
        setCommentCount(res.data.comment_count || 0)
        return listContents({ category: res.data.category, limit: 10 })
      })
      .then((res) => {
        if (res) setRelatedContents((res.data.contents || []).filter((c) => c.id !== id))
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>加载中...</div>
  }

  if (error || !content) {
    return <div className="p-6 text-center" style={{ color: '#606060' }}>内容不存在</div>
  }

  const isDraft = content.status === 'draft'
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id)
  const categoryPath = content.category === 'culture' ? '/culture' : '/learning'
  const categoryLabel = content.category === 'culture' ? '七牛文化' : '学习分享'
  const videoItems = (content.attachments || []).filter((m) => m.type === 'video')
  const currentVideo = videoItems[currentVideoIndex]

  const renderActions = () => (
    <div className="flex items-center justify-between pb-4" style={{ borderBottom: '1px solid #e5e5e5' }}>
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
        <div className={`whitespace-pre-wrap ${descExpanded ? '' : 'line-clamp-2'}`} style={{ cursor: 'pointer' }} onClick={() => setDescExpanded(!descExpanded)}>
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
      {(content.summary || content.speaker_name || content.speaker) && (
        <button className="mt-2 text-sm font-medium" style={{ color: '#065fd4' }} onClick={() => setDescExpanded(!descExpanded)}>
          {descExpanded ? '收起' : '展开'}
        </button>
      )}
    </div>
  )

  const renderPlaylist = () => {
    if (videoItems.length <= 1) return null
    return (
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid #e5e5e5' }}>
        <div className="px-4 py-2 text-sm font-medium" style={{ background: '#f9f9f9', color: '#0f0f0f' }}>
          播放列表 · {videoItems.length} 个视频
        </div>
        <div className="max-h-60 overflow-y-auto">
          {videoItems.map((v, i) => (
            <button
              key={v.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer"
              style={{ background: i === currentVideoIndex ? 'rgba(0,0,0,0.05)' : 'transparent', borderTop: i > 0 ? '1px solid #f2f2f2' : 'none' }}
              onClick={() => setCurrentVideoIndex(i)}
            >
              <span className="text-xs font-medium w-5 text-center flex-shrink-0" style={{ color: i === currentVideoIndex ? '#065fd4' : '#909090' }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm line-clamp-1" style={{ color: '#0f0f0f', fontWeight: i === currentVideoIndex ? 600 : 400 }}>
                  {v.title || `视频 ${i + 1}`}
                </div>
                {v.description && <div className="text-xs line-clamp-1" style={{ color: '#606060' }}>{v.description}</div>}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderSidebar = () => (
    <div className="hidden xl:block flex-shrink-0 w-[400px]">
      {renderPlaylist()}
      <Link to={categoryPath} className="inline-flex items-center gap-1 text-sm mb-4 hover:underline" style={{ color: '#606060' }}>
        <ArrowLeft size={16} />
        返回{categoryLabel}
      </Link>
      <div className="space-y-3">
        {relatedContents.map((item) => (
          <Link key={item.id} to={contentDetailPath(item)} className="flex gap-2 no-underline group" style={{ color: 'inherit' }}>
            <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-zinc-100" style={{ width: 168, aspectRatio: '16/9' }}>
              <img src={getContentCover(item)} alt={item.title} className="w-full h-full object-cover" />
              {item.type === 'video' && (
                <div className="absolute bottom-1 right-1 px-1 rounded text-xs" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>视频</div>
              )}
              {item.type === 'gallery' && (
                <div className="absolute bottom-1 right-1 px-1 rounded text-xs" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
                  {(item.attachments || []).length}图
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-2 mb-1" style={{ color: '#0f0f0f' }}>{item.title}</h4>
              <div className="text-xs" style={{ color: '#606060' }}>{item.author?.name || '未知作者'}</div>
              <div className="text-xs" style={{ color: '#606060' }}>{dayjs(item.created_at).fromNow()}</div>
            </div>
          </Link>
        ))}
        {relatedContents.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: '#606060' }}>暂无相关内容</div>
        )}
      </div>
    </div>
  )

  const renderDocuments = () => {
    const docs = (content.attachments || []).filter((a) => a.type === 'document')
    if (docs.length === 0) return null

    return (
      <div className="mt-4 p-4 rounded-xl" style={{ background: '#fff', border: '1px solid #e5e5e5' }}>
        <h3 className="text-base font-medium mb-3" style={{ color: '#0f0f0f' }}>资料下载</h3>
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
      草稿预览 — 此内容尚未发布，仅作者可见
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
              poster={content.cover_url || '/default-cover.svg'}
              theaterMode={theaterMode}
              onToggleTheater={() => setTheaterMode(!theaterMode)}
              contentId={`${content.id}_${currentVideoIndex}`}
            />
          </div>
        ) : (
          <div className={`relative overflow-hidden bg-zinc-100 ${theaterMode ? 'rounded-none' : 'rounded-xl'}`} style={{ width: '100%', aspectRatio: '16/9' }}>
            <img src={content.cover_url || '/default-cover.svg'} alt={content.title} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Playlist below player on small screens (no sidebar) */}
        <div className="xl:hidden mt-3">
          {renderPlaylist()}
        </div>

        <h1 className="text-xl font-medium mt-4 mb-3" style={{ color: '#0f0f0f', lineHeight: 1.4 }}>{content.title}</h1>
        {renderActions()}
        {renderDescription()}
        {renderDocuments()}
        <div id="comments">
          <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} />
        </div>
      </div>
      {!theaterMode && renderSidebar()}
    </div>
  )
}

export default VideoDetail
