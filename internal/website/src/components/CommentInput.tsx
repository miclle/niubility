import { useState, useEffect } from 'react'
import { Smile } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from 'src/components/ui/avatar'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import { autoResizeTextarea } from 'src/lib/textarea'

// COMMON_EMOJIS is the set of emojis available in the picker.
const COMMON_EMOJIS = [
  '\u{1F600}', '\u{1F602}', '\u{1F923}', '\u{1F60A}', '\u{1F60D}', '\u{1F970}', '\u{1F618}', '\u{1F60E}',
  '\u{1F914}', '\u{1F62E}', '\u{1F622}', '\u{1F62D}', '\u{1F621}', '\u{1F97A}', '\u{1F631}', '\u{1F917}',
  '\u{1F44D}', '\u{1F44E}', '\u{1F44F}', '\u{1F64C}', '\u{1F389}', '\u{1F525}', '\u{2764}\u{FE0F}', '\u{1F4AF}',
  '\u{2705}', '\u{2B50}', '\u{1F4AA}', '\u{1F64F}', '\u{1F604}', '\u{1F601}', '\u{1F929}', '\u{1F607}',
]

interface EmojiPickerProps {
  active: boolean
  onToggle: () => void
  onSelect: (emoji: string) => void
  pickerRef?: React.RefObject<HTMLDivElement>
  iconSize?: number
}

// EmojiPicker renders an emoji selection popup triggered by a smile button.
export function EmojiPicker({ active, onToggle, onSelect, pickerRef, iconSize = 18 }: EmojiPickerProps) {
  return (
    <div className="relative" ref={active ? pickerRef : undefined}>
      <button
        type="button"
        className="app-text-secondary p-1.5 rounded-full hover:bg-[var(--surface-hover)] transition-colors"
        onClick={onToggle}
      >
        <Smile size={iconSize} />
      </button>
      {active && (
        <div
          className="app-surface-elevated absolute left-0 bottom-full mb-1 w-[280px] grid grid-cols-8 gap-0.5 p-2 rounded-lg shadow-lg border app-border z-50"
        >
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--surface-hover)] text-lg cursor-pointer"
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CommentInputProps {
  currentUser: { avatar: string; name: string; username: string }
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  submitting: boolean
  emojiPickerActive: boolean
  onEmojiToggle: () => void
  onEmojiSelect: (emoji: string) => void
  emojiPickerRef: React.RefObject<HTMLDivElement>
}

// CommentInput renders the new-comment input area with emoji picker.
function CommentInput({ currentUser, value, onChange, onSubmit, submitting, emojiPickerActive, onEmojiToggle, onEmojiSelect, emojiPickerRef }: CommentInputProps) {
  const { t } = useTranslation('comments')
  const [focused, setFocused] = useState(false)

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiPickerActive) return
    const handleClick = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        onEmojiToggle()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [emojiPickerActive, emojiPickerRef, onEmojiToggle])

  return (
    <div className="flex gap-3 mb-6">
      <Avatar className="size-9">
        <SiteAvatarImage src={currentUser.avatar} alt={currentUser.name || currentUser.username} />
        <AvatarFallback>{currentUser.name?.charAt(0) || t('common:meAbbrev')}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <textarea
          rows={1}
          className="w-full border-b text-sm py-1 outline-none bg-transparent resize-none overflow-hidden"
          style={{ borderColor: focused ? 'var(--foreground)' : 'var(--surface-border)', color: 'var(--foreground)' }}
          placeholder={t('comments:addComment')}
          value={value}
          onChange={(e) => { onChange(e.target.value); autoResizeTextarea(e.target) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit() } }}
          onFocus={() => setFocused(true)}
        />
        {focused && (
          <div className="flex items-center justify-between mt-2">
            <EmojiPicker
              active={emojiPickerActive}
              onToggle={onEmojiToggle}
              onSelect={onEmojiSelect}
              pickerRef={emojiPickerRef}
            />
            <div className="flex gap-2">
              <button
                className="text-sm px-3 py-1.5 rounded-full"
                style={{ color: 'var(--text-secondary)' }}
                onClick={() => { onChange(''); setFocused(false) }}
              >
                {t('comments:cancel')}
              </button>
              <button
                className="text-sm px-3 py-1.5 rounded-full text-white disabled:opacity-50"
                style={{ background: 'var(--brand)' }}
                disabled={!value.trim() || submitting}
                onClick={onSubmit}
              >
                {t('comments:submit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommentInput
