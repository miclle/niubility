import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ThumbsUp, Pencil, Bookmark, Mic } from 'lucide-react'
import dayjs from 'dayjs'
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
  const [descExpanded, setDescExpanded] = useState(false)
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
  }, [setSearchParams]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Load related podcasts
  useEffect(() => {
    if (!content || !content.category) return
    listContents({
      type: 'podcast',
      category: content.category,
      limit: 12,
    })
      .then((res) => setRelatedContents(res.data.items))
      .catch(() => {})
  }, [content])

  const handleLike = async () => {
    if (!content || !currentUser) return
    try {
      const res = await toggleLike('content', content.id)
      setLiked(res.data.liked ?? false)
      setLikeCount(res.data.like_count ?? 0)
    } catch (err) {
      console.error('Failed to toggle like:', err)
    }
  }

  const handleFavorite = async () => {
    if (!content || !currentUser) return
    try {
      const res = await favoriteContent(content.id)
      setFavorited(res.data.favorited ?? false)
      setFavoriteCount(res.data.favorite_count ?? 0)
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

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

  const category = categories ? categories.find((c) => c.id === content.category) : null
  const coverUrl = getContentCover(content, siteConfig)
  const attachments = content.attachments || []
  const audioAttachments = attachments.filter((a) => a.type === 'audio')
  const currentAudio = audioAttachments[currentPodcastIndex] || audioAttachments[0]

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-start gap-6 mb-6">
        <div className="flex-shrink-0">
          <img
            src={coverUrl}
            alt={content.title}
            className="w-32 h-32 rounded-lg object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#0f0f0f' }}>{content.title}</h1>
          <div className="flex items-center gap-4 mb-4 text-sm" style={{ color: '#909090' }}>
              <Link
                to={`/@${content.author?.username}`}
                className="flex items-center gap-2 hover:underline"
                style={{ color: '#0f0f0f' }}
              >
                <Avatar className="w-6 h-6">
                  <SiteAvatarImage src={content.author?.avatar} alt={content.author?.name} />
                  <AvatarFallback>{content.author?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{content.author?.name}</span>
              </Link>
            <span>{dayjs(content.created_at).format('YYYY-MM-DD')}</span>
            {category && (
              <Link
                to={`/${category.slug}`}
                className="hover:underline"
                style={{ color: '#0f0f0f' }}
              >
                {category.name}
              </Link>
            )}
          </div>

          {/* Audio Player */}
          {currentAudio && (
            <div className="mb-4">
              <AudioPlayer src={fileURL(currentAudio.url)} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                liked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={!currentUser}
            >
              <ThumbsUp size={16} />
              <span>{likeCount}</span>
            </button>
            <button
              onClick={handleFavorite}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                favorited ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              disabled={!currentUser}
            >
              <Bookmark size={16} />
              <span>{favoriteCount}</span>
            </button>
            <ShareButton title={content.title} text={content.summary} url={window.location.href} />
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id) && (
              <Link
                to={contentEditPath(content)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <Pencil size={16} />
                <span>{t('content:edit')}</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="mb-8">
        <div
          className={`prose prose-sm max-w-none ${descExpanded ? '' : 'line-clamp-3'}`}
          style={{ color: '#0f0f0f' }}
          dangerouslySetInnerHTML={{ __html: content.summary || '' }}
        />
        {content.summary && content.summary.length > 200 && (
          <button
            onClick={() => setDescExpanded(!descExpanded)}
            className="text-sm mt-2 hover:underline"
            style={{ color: '#0f0f0f' }}
          >
            {descExpanded ? t('content:showLess') : t('content:showMore')}
          </button>
        )}
      </div>

      {/* Audio Files List */}
      {audioAttachments.length > 1 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: '#0f0f0f' }}>{t('content:episodes')}</h3>
          <div className="space-y-2">
            {audioAttachments.map((audio, index) => (
              <div
                key={audio.id}
                className={`flex items-center gap-4 p-3 rounded-lg cursor-pointer transition-colors ${
                  index === currentPodcastIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => setCurrentPodcastIndex(index)}
              >
                <Mic size={20} style={{ color: '#909090' }} />
                <div className="flex-1">
                  <div className="font-medium" style={{ color: '#0f0f0f' }}>{audio.filename}</div>
                  <div className="text-sm" style={{ color: '#909090' }}>{formatFileSize(audio.file_size)}</div>
                </div>
                {index === currentPodcastIndex && (
                  <div className="text-sm font-medium" style={{ color: '#0f0f0f' }}>{t('content:playing')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      <CommentSection contentID={content.id} commentCount={commentCount} onCommentCountChange={setCommentCount} />

      {/* Related Podcasts */}
      {relatedContents.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>{t('content:relatedPodcasts')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedContents.map((related) => (
              <Link
                key={related.id}
                to={contentDetailPath(related)}
                className="block group"
              >
                <div className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 relative">
                    <img
                      src={getContentCover(related, siteConfig) || ''}
                      alt={related.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Mic size={48} className="text-white" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold mb-2 line-clamp-2" style={{ color: '#0f0f0f' }}>{related.title}</h4>
                    {related.author && (
                      <div className="flex items-center gap-2 text-sm" style={{ color: '#909090' }}>
                        <Avatar className="w-5 h-5">
                          <SiteAvatarImage src={related.author.avatar} alt={related.author.name} />
                          <AvatarFallback>{related.author.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{related.author.name}</span>
                        <span>•</span>
                        <span>{dayjs(related.created_at).format('MM-DD')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PodcastDetail
