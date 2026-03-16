import { useState, useEffect, useCallback, useRef } from 'react'
import { ThumbsUp, MessageCircle, ChevronDown, ChevronUp, Smile } from 'lucide-react'
import dayjs from 'dayjs'

import { listComments, createComment, likeComment as likeCommentAPI } from 'src/api/content'
import { useAppContext } from 'src/context/app'
import { Avatar, AvatarImage, AvatarFallback } from 'src/components/ui/avatar'
import type { Comment, CreateCommentArgs } from 'src/types/content'

interface CommentSectionProps {
  contentID: string
  commentCount: number
  onCommentCountChange?: (count: number) => void
}

// CommentSection displays and manages comments for a content item.
function CommentSection({ contentID, commentCount, onCommentCountChange }: CommentSectionProps) {
  const { currentUser } = useAppContext()
  const [comments, setComments] = useState<Comment[]>([])
  const [likedCommentIDs, setLikedCommentIDs] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ commentID: string; parentID: string; userName: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set())
  const [commentFocused, setCommentFocused] = useState(false)
  const [emojiPickerFor, setEmojiPickerFor] = useState<'new' | 'reply' | null>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerFor) return
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerFor(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [emojiPickerFor])

  const commonEmojis = [
    '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎',
    '🤔', '😮', '😢', '😭', '😡', '🥺', '😱', '🤗',
    '👍', '👎', '👏', '🙌', '🎉', '🔥', '❤️', '💯',
    '✅', '⭐', '💪', '🙏', '😄', '😁', '🤩', '😇',
  ]

  const insertEmoji = (emoji: string, target: 'new' | 'reply') => {
    if (target === 'new') {
      setNewComment((prev) => prev + emoji)
    } else {
      setReplyText((prev) => prev + emoji)
    }
    setEmojiPickerFor(null)
  }

  const fetchComments = useCallback((pageNum: number) => {
    setLoading(true)
    listComments(contentID, { page: pageNum, limit: 20 })
      .then((res) => {
        if (pageNum === 1) {
          setComments(res.data.comments || [])
        } else {
          setComments((prev) => [...prev, ...(res.data.comments || [])])
        }
        setTotal(res.data.pagination.total)
        setLikedCommentIDs(new Set(res.data.liked_comment_ids || []))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [contentID])

  useEffect(() => {
    fetchComments(1)
    setPage(1)
  }, [fetchComments])

  // Submit a top-level comment
  const handleSubmit = () => {
    if (!newComment.trim() || submitting) return
    setSubmitting(true)
    createComment(contentID, { body: newComment.trim() })
      .then((res) => {
        setComments((prev) => [res.data, ...prev])
        setNewComment('')
        setTotal((t) => t + 1)
        onCommentCountChange?.(commentCount + 1)
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  // Submit a reply
  const handleReply = () => {
    if (!replyTo || !replyText.trim() || submitting) return
    setSubmitting(true)
    const data: CreateCommentArgs = {
      body: replyText.trim(),
      parent_id: replyTo.parentID,
      reply_to_id: replyTo.commentID,
    }
    createComment(contentID, data)
      .then((res) => {
        // Add reply to the parent comment's replies array
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === replyTo.parentID) {
              return { ...c, replies: [...(c.replies || []), res.data] }
            }
            return c
          })
        )
        setReplyTo(null)
        setReplyText('')
        setTotal((t) => t + 1)
        onCommentCountChange?.(commentCount + 1)
        // Auto-expand replies for this parent
        setExpandedReplies((prev) => new Set([...prev, replyTo.parentID]))
      })
      .catch(() => {})
      .finally(() => setSubmitting(false))
  }

  // Toggle like on a comment
  const handleLikeComment = (commentID: string) => {
    likeCommentAPI(commentID)
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
        // Update like_count in the comment tree
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === commentID) {
              return { ...c, like_count: res.data.like_count }
            }
            if (c.replies?.length) {
              return {
                ...c,
                replies: c.replies.map((r) =>
                  r.id === commentID ? { ...r, like_count: res.data.like_count } : r
                ),
              }
            }
            return c
          })
        )
      })
      .catch(() => {})
  }

  const toggleReplies = (commentID: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev)
      if (next.has(commentID)) {
        next.delete(commentID)
      } else {
        next.add(commentID)
      }
      return next
    })
  }

  // Start replying to a comment
  const startReply = (commentID: string, parentID: string, userName: string) => {
    setReplyTo({ commentID, parentID, userName })
    setReplyText('')
  }

  const renderComment = (comment: Comment, isReply = false) => {
    const isLiked = likedCommentIDs.has(comment.id)
    const parentID = isReply ? comment.parent_id : comment.id

    return (
      <div key={comment.id} className={`flex gap-3 ${isReply ? 'ml-12' : ''}`}>
        {/* Avatar */}
        <Avatar size="sm">
          <AvatarImage src={comment.user?.avatar} alt={comment.user?.name || '匿名'} />
          <AvatarFallback>{comment.user?.name?.charAt(0) || '匿'}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium" style={{ color: '#0f0f0f' }}>
              {comment.user?.name || '匿名用户'}
            </span>
            <span className="text-xs" style={{ color: '#606060' }}>
              {dayjs(comment.created_at).fromNow()}
            </span>
          </div>

          {/* Reply indicator */}
          {isReply && comment.reply_to?.user && comment.reply_to_id !== comment.parent_id && (
            <div className="text-xs mt-0.5" style={{ color: '#606060' }}>
              回复 <span className="font-medium">{comment.reply_to.user.name}</span>
            </div>
          )}

          {/* Body */}
          <div className="text-sm mt-1" style={{ color: '#0f0f0f' }}>
            {comment.body}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-1.5">
            <button
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: isLiked ? '#065fd4' : '#606060' }}
              onClick={() => handleLikeComment(comment.id)}
            >
              <ThumbsUp size={14} fill={isLiked ? 'currentColor' : 'none'} />
              {comment.like_count > 0 && <span>{comment.like_count}</span>}
            </button>
            <button
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: '#606060' }}
              onClick={() => startReply(comment.id, parentID, comment.user?.name || '匿名用户')}
            >
              <MessageCircle size={14} />
              <span>回复</span>
            </button>
          </div>

          {/* Reply input for this comment */}
          {replyTo?.commentID === comment.id && (
            <div className="mt-3">
              <input
                type="text"
                className="w-full border-b text-sm py-1 outline-none bg-transparent"
                style={{ borderColor: '#065fd4', color: '#0f0f0f' }}
                placeholder={`回复 @${replyTo.userName}`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                autoFocus
              />
              <div className="flex items-center justify-between mt-2">
                <div className="relative" ref={emojiPickerFor === 'reply' ? emojiPickerRef : undefined}>
                  <button
                    type="button"
                    className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
                    style={{ color: '#606060' }}
                    onClick={() => setEmojiPickerFor(emojiPickerFor === 'reply' ? null : 'reply')}
                  >
                    <Smile size={16} />
                  </button>
                  {emojiPickerFor === 'reply' && (
                    <div
                      className="absolute left-0 bottom-full mb-1 w-[280px] grid grid-cols-8 gap-0.5 p-2 rounded-lg shadow-lg border z-50"
                      style={{ background: '#fff', borderColor: '#e5e5e5' }}
                    >
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/5 text-lg cursor-pointer"
                          onClick={() => insertEmoji(emoji, 'reply')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ color: '#606060' }}
                    onClick={() => setReplyTo(null)}
                  >
                    取消
                  </button>
                  <button
                    className="text-xs px-3 py-1 rounded-full text-white disabled:opacity-50"
                    style={{ background: '#065fd4' }}
                    disabled={!replyText.trim() || submitting}
                    onClick={handleReply}
                  >
                    回复
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <h3 className="text-base font-medium mb-5" style={{ color: '#0f0f0f' }}>
        {total > 0 ? `${total} 条评论` : '评论'}
      </h3>

      {/* New comment input */}
      {currentUser && (
        <div className="flex gap-3 mb-6">
          <Avatar size="sm">
            <AvatarImage src={currentUser.avatar} alt={currentUser.name || currentUser.username} />
            <AvatarFallback>{currentUser.name?.charAt(0) || '我'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <input
              type="text"
              className="w-full border-b text-sm py-1 outline-none bg-transparent"
              style={{ borderColor: commentFocused ? '#0f0f0f' : '#e5e5e5', color: '#0f0f0f' }}
              placeholder="添加评论..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              onFocus={() => setCommentFocused(true)}
            />
            {commentFocused && (
              <div className="flex items-center justify-between mt-2">
                <div className="relative" ref={emojiPickerFor === 'new' ? emojiPickerRef : undefined}>
                  <button
                    type="button"
                    className="p-1.5 rounded-full hover:bg-black/5 transition-colors"
                    style={{ color: '#606060' }}
                    onClick={() => setEmojiPickerFor(emojiPickerFor === 'new' ? null : 'new')}
                  >
                    <Smile size={18} />
                  </button>
                  {emojiPickerFor === 'new' && (
                    <div
                      className="absolute left-0 bottom-full mb-1 w-[280px] grid grid-cols-8 gap-0.5 p-2 rounded-lg shadow-lg border z-50"
                      style={{ background: '#fff', borderColor: '#e5e5e5' }}
                    >
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/5 text-lg cursor-pointer"
                          onClick={() => insertEmoji(emoji, 'new')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-sm px-3 py-1.5 rounded-full"
                    style={{ color: '#606060' }}
                    onClick={() => { setNewComment(''); setCommentFocused(false) }}
                  >
                    取消
                  </button>
                  <button
                    className="text-sm px-3 py-1.5 rounded-full text-white disabled:opacity-50"
                    style={{ background: '#065fd4' }}
                    disabled={!newComment.trim() || submitting}
                    onClick={handleSubmit}
                  >
                    评论
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-5">
        {comments.map((comment) => (
          <div key={comment.id}>
            {renderComment(comment)}

            {/* Replies toggle */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-12 mt-2">
                <button
                  className="flex items-center gap-1 text-sm font-medium"
                  style={{ color: '#065fd4' }}
                  onClick={() => toggleReplies(comment.id)}
                >
                  {expandedReplies.has(comment.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  {comment.replies.length} 条回复
                </button>

                {expandedReplies.has(comment.id) && (
                  <div className="space-y-4 mt-3">
                    {comment.replies.map((reply) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load more */}
      {comments.length < total && (
        <div className="text-center mt-6">
          <button
            className="text-sm font-medium px-4 py-2 rounded-full"
            style={{ color: '#065fd4', background: 'rgba(6,95,212,0.05)' }}
            disabled={loading}
            onClick={() => {
              const nextPage = page + 1
              setPage(nextPage)
              fetchComments(nextPage)
            }}
          >
            {loading ? '加载中...' : '加载更多评论'}
          </button>
        </div>
      )}

      {!loading && comments.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: '#606060' }}>
          暂无评论，来说两句吧
        </div>
      )}
    </div>
  )
}

export default CommentSection
