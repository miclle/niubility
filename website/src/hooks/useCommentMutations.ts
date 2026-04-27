import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { createCommentBody, toggleLike, pinComment, deleteComment } from 'src/api/content'
import type { Comment, CreateCommentArgs } from 'src/types/content'

interface UseCommentMutationsOptions {
  contentID: string
  attachmentID?: string
  commentCount: number
  onCommentCountChange?: (count: number) => void
}

// useCommentMutations encapsulates all comment mutation logic and optimistic state.
export function useCommentMutations({ contentID, attachmentID, commentCount, onCommentCountChange }: UseCommentMutationsOptions) {
  const queryClient = useQueryClient()
  const [localComments, setLocalComments] = useState<Comment[]>([])
  const [likeOverrides, setLikeOverrides] = useState<Map<string, number>>(new Map())
  const [pinOverrides, setPinOverrides] = useState<Map<string, string | null>>(new Map())
  const [submitting, setSubmitting] = useState(false)
  const localCountDelta = useRef(0)

  const getDisplayLikeCount = (comment: Comment): number => {
    return likeOverrides.get(comment.id) ?? comment.like_count
  }

  const getDisplayPinnedAt = (comment: Comment): string | undefined => {
    if (pinOverrides.has(comment.id)) {
      return pinOverrides.get(comment.id) ?? undefined
    }
    return comment.pinned_at
  }

  // Submit a top-level comment
  const handleSubmit = (body: string, onSuccess: () => void) => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    createCommentBody({ content_id: contentID, body: body.trim(), attachment_id: attachmentID })
      .then((res) => {
        setLocalComments((prev) => [res.data, ...prev])
        localCountDelta.current += 1
        onCommentCountChange?.(commentCount + localCountDelta.current)
        onSuccess()
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  // Submit a reply to a comment
  const handleReply = (
    replyTo: { commentID: string; parentID: string },
    body: string,
    onSuccess: () => void,
  ) => {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    const replyData: CreateCommentArgs = {
      body: body.trim(),
      parent_id: replyTo.parentID,
      reply_to_id: replyTo.commentID,
      attachment_id: attachmentID,
    }
    createCommentBody({ content_id: contentID, ...replyData })
      .then((res) => {
        const addReply = (comments: Comment[]) =>
          comments.map((c) =>
            c.id === replyTo.parentID
              ? { ...c, replies: [...(c.replies || []), res.data] }
              : c
          )
        setLocalComments(addReply)
        localCountDelta.current += 1
        onCommentCountChange?.(commentCount + localCountDelta.current)
        onSuccess()
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  // Toggle like on a comment
  const handleLikeComment = (
    commentID: string,
    setLikedCommentIDs: React.Dispatch<React.SetStateAction<Set<string>>>,
  ) => {
    toggleLike('comment', commentID)
      .then((res) => {
        setLikedCommentIDs((prev) => {
          const next = new Set(prev)
          if (res.data.liked) {
            next.add(commentID)
          } else {
            next.delete(commentID)
          }
          return next
        })
        setLikeOverrides((prev) => new Map(prev).set(commentID, res.data.like_count))
      })
      .catch(() => {})
  }

  // Toggle pin on a comment (admin only)
  const handlePinComment = (commentID: string, currentlyPinned: boolean) => {
    pinComment(commentID, !currentlyPinned)
      .then((res) => {
        setPinOverrides((prev) => {
          const next = new Map(prev)
          next.set(commentID, res.data.pinned_at || null)
          return next
        })
      })
      .catch(() => {})
  }

  // Delete a comment (own comment or admin)
  const handleDeleteComment = (commentID: string) => {
    deleteComment(commentID)
      .then(() => {
        setLocalComments((prev) => prev.filter((c) => c.id !== commentID && c.parent_id !== commentID))
        queryClient.invalidateQueries({ queryKey: ['comments', contentID, attachmentID] })
        localCountDelta.current -= 1
        onCommentCountChange?.(commentCount + localCountDelta.current)
      })
      .catch(() => {})
  }

  return {
    localComments,
    localCountDelta,
    submitting,
    getDisplayLikeCount,
    getDisplayPinnedAt,
    handleSubmit,
    handleReply,
    handleLikeComment,
    handlePinComment,
    handleDeleteComment,
  }
}
