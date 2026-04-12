import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listCommentsQuery } from 'src/api/content'
import { useAppContext } from 'src/context/app'
import { useCommentMutations } from 'src/hooks/useCommentMutations'
import CommentInput from 'src/components/CommentInput'
import CommentCard from 'src/components/CommentCard'
import type { Comment } from 'src/types/content'

interface CommentSectionProps {
  contentID: string
  attachmentID?: string
  commentCount: number
  onCommentCountChange?: (count: number) => void
  highlightedCommentID?: string
}

// CommentSection displays and manages comments for a content item.
function CommentSection({ contentID, attachmentID, commentCount, onCommentCountChange, highlightedCommentID }: CommentSectionProps) {
  const { t } = useTranslation('comments')
  const { currentUser } = useAppContext()
  const [likedCommentIDs, setLikedCommentIDs] = useState<Set<string>>(new Set())
  const [replyTo, setReplyTo] = useState<{ commentID: string; parentID: string; userName: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [newComment, setNewComment] = useState('')
  const [emojiPickerFor, setEmojiPickerFor] = useState<'new' | 'reply' | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const [activeHighlightCommentID, setActiveHighlightCommentID] = useState<string | null>(highlightedCommentID || null)

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const mutations = useCommentMutations({ contentID, attachmentID, commentCount, onCommentCountChange })

  // Fetch comments with infinite scrolling
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['comments', contentID, attachmentID],
      queryFn: ({ pageParam }) =>
        listCommentsQuery({ content_id: contentID, cursor: pageParam, limit: 20, attachment_id: attachmentID }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const total = (data?.pages[0]?.data.total ?? 0) + mutations.localCountDelta.current

  // Merge liked IDs from all pages
  useEffect(() => {
    if (!data) return
    const ids = new Set<string>()
    for (const page of data.pages) {
      for (const id of page.data.liked_comment_ids || []) {
        ids.add(id)
      }
    }
    setLikedCommentIDs(ids)
  }, [data])

  const allComments = useMemo(() => {
    const serverComments = data?.pages.flatMap((p) => p.data.items) ?? []
    return [...mutations.localComments, ...serverComments]
  }, [data, mutations.localComments])

  // Highlight management
  useEffect(() => {
    setActiveHighlightCommentID(highlightedCommentID || null)
  }, [highlightedCommentID])

  const hasHighlightedComment = useCallback((comments: Comment[], commentID: string): boolean => {
    for (const comment of comments) {
      if (comment.id === commentID) return true
      if ((comment.replies || []).some((reply) => reply.id === commentID)) return true
    }
    return false
  }, [])

  useEffect(() => {
    if (!highlightedCommentID) return
    if (hasHighlightedComment(allComments, highlightedCommentID)) return
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [allComments, fetchNextPage, hasHighlightedComment, hasNextPage, highlightedCommentID, isFetchingNextPage])

  useEffect(() => {
    if (!activeHighlightCommentID) return
    const timer = window.setTimeout(() => setActiveHighlightCommentID(null), 4000)
    return () => window.clearTimeout(timer)
  }, [activeHighlightCommentID])

  useEffect(() => {
    if (!activeHighlightCommentID) return
    const element = document.getElementById(`comment-${activeHighlightCommentID}`)
    if (!element) return
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeHighlightCommentID, allComments])

  // Emoji helpers
  const insertEmoji = (emoji: string, target: 'new' | 'reply') => {
    if (target === 'new') {
      setNewComment((prev) => prev + emoji)
    } else {
      setReplyText((prev) => prev + emoji)
    }
    setEmojiPickerFor(null)
  }

  // Reply actions
  const startReply = (commentID: string, parentID: string, userName: string) => {
    setReplyTo({ commentID, parentID, userName })
    setReplyText('')
  }

  const handleReplySubmit = () => {
    if (!replyTo) return
    mutations.handleReply(replyTo, replyText, () => {
      const parentID = replyTo.parentID
      setReplyTo(null)
      setReplyText('')
      setExpandedReplies((prev) => new Set([...prev, parentID]))
    })
  }

  const toggleReplies = (commentID: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      if (next.has(commentID)) { next.delete(commentID) } else { next.add(commentID) }
      return next
    })
  }

  const loading = isLoading || isFetchingNextPage

  return (
    <div className="comment-section mt-6" data-testid="comment-section">
      <h3 className="text-base font-medium mb-5 text-foreground">
        {total > 0 ? t('comments:commentsCount', { count: total }) : t('comments:comments')}
      </h3>

      {/* New comment input */}
      {currentUser && (
        <CommentInput
          currentUser={currentUser}
          value={newComment}
          onChange={setNewComment}
          onSubmit={() => mutations.handleSubmit(newComment, () => setNewComment(''))}
          submitting={mutations.submitting}
          emojiPickerActive={emojiPickerFor === 'new'}
          onEmojiToggle={() => setEmojiPickerFor(emojiPickerFor === 'new' ? null : 'new')}
          onEmojiSelect={(emoji) => insertEmoji(emoji, 'new')}
          emojiPickerRef={emojiPickerRef}
        />
      )}

      {/* Comment list */}
      <div className="space-y-5">
        {allComments.map((comment) => (
          <div key={comment.id}>
            <CommentCard
              comment={comment}
              isLiked={likedCommentIDs.has(comment.id)}
              displayLikeCount={mutations.getDisplayLikeCount(comment)}
              displayPinnedAt={mutations.getDisplayPinnedAt(comment)}
              isHighlighted={activeHighlightCommentID === comment.id}
              isAdmin={isAdmin}
              currentUserID={currentUser?.id}
              replyTo={replyTo}
              replyText={replyText}
              emojiPickerFor={emojiPickerFor}
              emojiPickerRef={emojiPickerRef}
              onLike={(id) => mutations.handleLikeComment(id, setLikedCommentIDs)}
              onStartReply={startReply}
              onPin={mutations.handlePinComment}
              onDelete={mutations.handleDeleteComment}
              onReplyTextChange={setReplyText}
              onCancelReply={() => setReplyTo(null)}
              onReplySubmit={handleReplySubmit}
              onEmojiToggle={() => setEmojiPickerFor(emojiPickerFor === 'reply' ? null : 'reply')}
              onEmojiSelect={(emoji) => insertEmoji(emoji, 'reply')}
              submitting={mutations.submitting}
            />

            {/* Replies toggle */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-12 mt-2">
                <button
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: 'var(--brand)' }}
                  onClick={() => toggleReplies(comment.id)}
                >
                  {expandedReplies.has(comment.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {t('comments:repliesCount', { count: comment.replies.length })}
                </button>

                {expandedReplies.has(comment.id) && (
                  <div className="space-y-4 mt-3">
                    {comment.replies.map((reply) => (
                      <CommentCard
                        key={reply.id}
                        comment={reply}
                        isReply
                        isLiked={likedCommentIDs.has(reply.id)}
                        displayLikeCount={mutations.getDisplayLikeCount(reply)}
                        displayPinnedAt={mutations.getDisplayPinnedAt(reply)}
                        isHighlighted={activeHighlightCommentID === reply.id}
                        isAdmin={isAdmin}
                        currentUserID={currentUser?.id}
                        replyTo={replyTo}
                        replyText={replyText}
                        emojiPickerFor={emojiPickerFor}
                        emojiPickerRef={emojiPickerRef}
                        onLike={(id) => mutations.handleLikeComment(id, setLikedCommentIDs)}
                        onStartReply={startReply}
                        onPin={mutations.handlePinComment}
                        onDelete={mutations.handleDeleteComment}
                        onReplyTextChange={setReplyText}
                        onCancelReply={() => setReplyTo(null)}
                        onReplySubmit={handleReplySubmit}
                        onEmojiToggle={() => setEmojiPickerFor(emojiPickerFor === 'reply' ? null : 'reply')}
                        onEmojiSelect={(emoji) => insertEmoji(emoji, 'reply')}
                        submitting={mutations.submitting}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center mt-6">
          <button
            className="text-sm font-medium px-4 py-2 rounded-full"
            style={{ color: 'var(--brand)', background: 'var(--brand-soft)' }}
            disabled={loading}
            onClick={() => fetchNextPage()}
          >
            {loading ? t('common:loading') : t('comments:loadMore')}
          </button>
        </div>
      )}

      {!loading && allComments.length === 0 && (
        <div className="app-text-secondary text-center py-8 text-sm">
          {t('comments:noComments')}
        </div>
      )}
    </div>
  )
}

export default CommentSection
