import { useState } from 'react'
import { ThumbsUp, MessageCircle, Pin, Trash2, Link2, Check } from 'lucide-react'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from 'src/components/ui/alert-dialog'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import { EmojiPicker, autoResize } from 'src/components/CommentInput'
import type { Comment } from 'src/types/content'

// CopyLinkButton renders a copy button that copies the comment anchor URL to clipboard.
function CopyLinkButton({ commentID }: { commentID: string }) {
  const { t } = useTranslation('comments')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${commentID}`
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const input = document.createElement('input')
        input.value = url
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        document.body.removeChild(input)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Silently fail
    }
  }

  return (
    <button
      className="flex items-center gap-1 text-xs transition-colors"
      style={{ color: copied ? '#065fd4' : '#606060' }}
      onClick={handleCopy}
      title={copied ? t('copied') : t('copyLink')}
    >
      {copied ? <Check size={14} /> : <Link2 size={14} />}
    </button>
  )
}

interface CommentCardProps {
  comment: Comment
  isReply?: boolean
  isLiked: boolean
  displayLikeCount: number
  displayPinnedAt?: string
  isHighlighted: boolean
  isAdmin: boolean
  currentUserID?: string
  // Reply state
  replyTo: { commentID: string; parentID: string; userName: string } | null
  replyText: string
  emojiPickerFor: 'new' | 'reply' | null
  emojiPickerRef: React.RefObject<HTMLDivElement>
  // Callbacks
  onLike: (commentID: string) => void
  onStartReply: (commentID: string, parentID: string, userName: string) => void
  onPin: (commentID: string, currentlyPinned: boolean) => void
  onDelete: (commentID: string) => void
  onReplyTextChange: (text: string) => void
  onCancelReply: () => void
  onReplySubmit: () => void
  onEmojiToggle: (target: 'reply') => void
  onEmojiSelect: (emoji: string, target: 'reply') => void
  submitting: boolean
}

// CommentCard renders a single comment with its actions, reply input, and delete dialog.
function CommentCard({
  comment, isReply = false, isLiked, displayLikeCount, displayPinnedAt,
  isHighlighted, isAdmin, currentUserID,
  replyTo, replyText, emojiPickerFor, emojiPickerRef,
  onLike, onStartReply, onPin, onDelete,
  onReplyTextChange, onCancelReply, onReplySubmit,
  onEmojiToggle, onEmojiSelect, submitting,
}: CommentCardProps) {
  const { t } = useTranslation('comments')
  const isPinned = !!displayPinnedAt
  const parentID = isReply ? comment.parent_id : comment.id

  return (
    <div
      id={`comment-${comment.id}`}
      className={`flex gap-3 rounded-2xl px-3 py-2 transition-colors ${isReply ? 'ml-12' : ''}`}
      style={isHighlighted ? { background: 'rgba(6,95,212,0.08)', boxShadow: 'inset 0 0 0 1px rgba(6,95,212,0.22)' } : undefined}
    >
      {/* Avatar */}
      <Avatar className="size-9">
        <SiteAvatarImage src={comment.user?.avatar || ''} alt={comment.user?.name || t('common:anonymousUser')} />
        <AvatarFallback>{comment.user?.name?.charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium" style={{ color: '#0f0f0f' }}>
            {comment.user?.name || t('comments:anonymousUser')}
          </span>
          {isPinned && (
            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded" style={{ color: '#065fd4', background: 'rgba(6,95,212,0.1)' }}>
              <Pin size={10} />
              {t('comments:pinned')}
            </span>
          )}
          <span className="text-xs" style={{ color: '#606060' }}>
            {dayjs(comment.created_at).fromNow()}
          </span>
        </div>

        {/* Reply indicator */}
        {isReply && comment.reply_to?.user && comment.reply_to_id !== comment.parent_id && (
          <div className="text-xs mt-0.5" style={{ color: '#606060' }}>
            {t('comments:replyToUser')} <span className="font-medium">{comment.reply_to.user.name}</span>
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
            onClick={() => onLike(comment.id)}
          >
            <ThumbsUp size={14} fill={isLiked ? 'currentColor' : 'none'} />
            {displayLikeCount > 0 && <span>{displayLikeCount}</span>}
          </button>
          <button
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: '#606060' }}
            onClick={() => onStartReply(comment.id, parentID, comment.user?.name || t('common:anonymousUser'))}
          >
            <MessageCircle size={14} />
            <span>{t('comments:reply')}</span>
          </button>
          {isAdmin && !isReply && (
            <button
              className="flex items-center gap-1 text-xs transition-colors"
              style={{ color: isPinned ? '#065fd4' : '#606060' }}
              onClick={() => onPin(comment.id, isPinned)}
            >
              <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
              <span>{isPinned ? t('comments:unpin') : t('comments:pinned')}</span>
            </button>
          )}
          {(comment.user_id === currentUserID || isAdmin) && (
            <AlertDialog>
              <AlertDialogTrigger className="flex items-center gap-1 text-xs transition-colors cursor-pointer" style={{ color: '#606060' }}>
                <Trash2 size={14} />
                <span>{t('comments:delete')}</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('comments:deleteComment')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('comments:deleteConfirm')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="rounded-md bg-muted/50 px-3 py-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-5">
                      <SiteAvatarImage src={comment.user?.avatar || ''} alt={comment.user?.name || t('common:anonymousUser')} />
                      <AvatarFallback className="text-[10px]">{comment.user?.name?.charAt(0) || t('common:anonymousAbbrev')}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-foreground">{comment.user?.name || t('comments:anonymousUser')}</span>
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap break-all">
                    {comment.body}
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('comments:cancel')}</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => onDelete(comment.id)}>{t('comments:delete')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <CopyLinkButton commentID={comment.id} />
        </div>

        {/* Reply input for this comment */}
        {replyTo?.commentID === comment.id && (
          <div className="mt-3">
            <textarea
              rows={1}
              className="w-full border-b text-sm py-1 outline-none bg-transparent resize-none overflow-hidden"
              style={{ borderColor: '#065fd4', color: '#0f0f0f' }}
              placeholder={t('comments:replyTo', { name: replyTo.userName })}
              value={replyText}
              onChange={(e) => { onReplyTextChange(e.target.value); autoResize(e.target) }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onReplySubmit() } }}
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <EmojiPicker
                active={emojiPickerFor === 'reply'}
                onToggle={() => onEmojiToggle('reply')}
                onSelect={(emoji) => onEmojiSelect(emoji, 'reply')}
                pickerRef={emojiPickerRef}
                iconSize={16}
              />
              <div className="flex gap-2">
                <button
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ color: '#606060' }}
                  onClick={onCancelReply}
                >
                  {t('comments:cancel')}
                </button>
                <button
                  className="text-xs px-3 py-1 rounded-full text-white disabled:opacity-50"
                  style={{ background: '#065fd4' }}
                  disabled={!replyText.trim() || submitting}
                  onClick={onReplySubmit}
                >
                  {t('comments:reply')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommentCard
