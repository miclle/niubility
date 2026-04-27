import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'

import { getContent, listContents, toggleLike, favoriteContent } from 'src/api/content'
import { recordContentView } from 'src/api/view'
import { contentDetailPath } from 'src/lib/content-url'
import { useAppContext } from 'src/context/app'
import type { Content } from 'src/types/content'

// UseContentDetailOptions configures the shared detail loading hook.
interface UseContentDetailOptions {
  expectedType: string
  relatedLimit?: number
}

// UseContentDetailResult is the return value of useContentDetail.
interface UseContentDetailResult {
  content: Content | null
  relatedContents: Content[]
  loading: boolean
  error: boolean
  // Interaction state
  liked: boolean
  likeCount: number
  favorited: boolean
  favoriteCount: number
  commentCount: number
  setCommentCount: (n: number) => void
  highlightedCommentID: string | undefined
  highlightedContent: boolean
  // Interaction handlers
  handleLike: () => void
  handleFavorite: () => void
  // Derived
  isDraft: boolean
  canEdit: boolean
  categoryLabel: string
}

// useContentDetail encapsulates the shared loading, view recording, and interaction logic
// for both video and podcast detail views.
function useContentDetail({ expectedType, relatedLimit = 10 }: UseContentDetailOptions): UseContentDetailResult {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentUser, categories } = useAppContext()

  const [content, setContent] = useState<Content | null>(null)
  const [relatedContents, setRelatedContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Interaction state
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [favoriteCount, setFavoriteCount] = useState(0)
  const [commentCount, setCommentCount] = useState(0)

  const highlightedCommentID = searchParams.get('liked_comment') || undefined
  const highlightedContent = searchParams.get('liked_content') === '1'

  // Load content + related
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(false)
    getContent(id)
      .then((res) => {
        const data = res.data
        // Redirect if type doesn't match this route
        if (data.type !== expectedType) {
          navigate(contentDetailPath(data), { replace: true })
          return
        }
        setContent(data)
        setLiked(data.liked ?? !!data.liked)
        setLikeCount(data.like_count ?? 0)
        setFavorited(data.favorited ?? !!data.favorited)
        setFavoriteCount(data.favorite_count ?? 0)
        setCommentCount(data.comment_count ?? 0)

        // Load related content
        if (data.category) {
          listContents({ category: data.category, type: expectedType, limit: relatedLimit })
            .then((relRes) => setRelatedContents((relRes.data.items || []).filter((c) => c.id !== id)))
            .catch(() => {})
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, navigate, expectedType, relatedLimit])

  // View recording — 5 second delay
  useEffect(() => {
    if (!currentUser || !content?.id) return

    const timer = window.setTimeout(() => {
      recordContentView(content.id, { trigger: 'detail' }).catch(() => {})
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [content?.id, currentUser])

  // Interaction handlers
  const handleLike = useCallback(() => {
    if (!currentUser || !content) return
    toggleLike('content', content.id).then((res) => {
      setLiked(res.data.liked ?? false)
      setLikeCount(res.data.like_count ?? 0)
    })
  }, [currentUser, content])

  const handleFavorite = useCallback(() => {
    if (!currentUser || !content) return
    favoriteContent(content.id).then((res) => {
      setFavorited(res.data.favorited ?? false)
      setFavoriteCount(res.data.favorite_count ?? 0)
    })
  }, [currentUser, content])

  // Derived values
  const isDraft = content?.status === 'draft'
  const canEdit = !!(currentUser && content && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.id === content.author_id))
  const categoryLabel = categories?.find((c) => c.slug === content?.category)?.name || content?.category || ''

  return {
    content,
    relatedContents,
    loading,
    error,
    liked,
    likeCount,
    favorited,
    favoriteCount,
    commentCount,
    setCommentCount,
    highlightedCommentID,
    highlightedContent,
    handleLike,
    handleFavorite,
    isDraft,
    canEdit,
    categoryLabel,
  }
}

export default useContentDetail
