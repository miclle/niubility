import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { X } from 'lucide-react'

import { searchUsers } from 'src/api/user'
import { useTranslation } from 'react-i18next'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { SearchUserItem } from 'src/types/user'

// SpeakerSelectorProps defines the props for the SpeakerSelector component.
export interface SpeakerSelectorProps {
  // Default speaker to pre-select
  defaultSpeaker?: SearchUserItem
  // Callback when a speaker is selected or cleared
  onChange: (speaker: SearchUserItem | null) => void
  // Optional label text
  label?: string
  // Whether to show the component (for conditional rendering)
  show?: boolean
}

// SpeakerSelector is a reusable component for selecting a speaker/author from user search.
export default function SpeakerSelector({ defaultSpeaker, onChange, label = '作者/主讲人', show = true }: SpeakerSelectorProps) {
  const { t } = useTranslation('editor')
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerInput, setSpeakerInput] = useState('')
  const [speakerResults, setSpeakerResults] = useState<SearchUserItem[]>([])
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false)
  const speakerDropdownRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speakerDropdownRef.current && !speakerDropdownRef.current.contains(e.target as Node)) {
        setShowSpeakerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Reset state when defaultSpeaker changes externally
  useEffect(() => {
    if (defaultSpeaker) {
      setSpeakerId(defaultSpeaker.id)
      setSelectedSpeaker(defaultSpeaker)
      return
    }
    setSpeakerId('')
    setSelectedSpeaker(null)
    setSpeakerInput('')
    setSpeakerResults([])
    setShowSpeakerDropdown(false)
  }, [defaultSpeaker])

  const handleSpeakerInputChange = (value: string) => {
    setSpeakerInput(value)
    if (speakerId) {
      setSpeakerId('')
      setSelectedSpeaker(null)
      onChange(null)
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value.trim()) {
      setSpeakerResults([])
      setShowSpeakerDropdown(false)
      return
    }
    searchTimerRef.current = setTimeout(() => {
      searchUsers(value.trim()).then((res) => {
        setSpeakerResults(res.data.users)
        setShowSpeakerDropdown(res.data.users.length > 0)
      })
    }, 300)
  }

  const handleSelectSpeaker = (user: SearchUserItem) => {
    setSpeakerId(user.id)
    setSelectedSpeaker(user)
    setSpeakerInput('')
    setSpeakerResults([])
    setShowSpeakerDropdown(false)
    onChange(user)
  }

  const handleClearSpeaker = () => {
    setSpeakerId('')
    setSelectedSpeaker(null)
    setSpeakerInput('')
    onChange(null)
  }

  if (!show) return null

  return (
    <div className="space-y-3">
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{label}</label>
        {selectedSpeaker ? (
          <div className="app-surface-muted border app-border flex items-center gap-3 p-3 rounded-lg">
            <Avatar className="h-8 w-8">
              <SiteAvatarImage src={selectedSpeaker.avatar} alt={selectedSpeaker.name} />
              <AvatarFallback>{selectedSpeaker.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground flex-1">{selectedSpeaker.name}</span>
            <button type="button" className="p-1 rounded-full hover:bg-[var(--surface-hover)] transition-colors" onClick={handleClearSpeaker}>
              <X size={14} className="app-text-tertiary" />
            </button>
          </div>
        ) : (
          <div className="relative" ref={speakerDropdownRef}>
            <Input
              placeholder={t('speakerPlaceholder')}
              value={speakerInput}
              onChange={(e) => handleSpeakerInputChange(e.target.value)}
              onFocus={() => { if (speakerResults.length > 0) setShowSpeakerDropdown(true) }}
            />
            {showSpeakerDropdown && speakerResults.length > 0 && (
              <div className="app-surface-elevated border app-border absolute z-10 w-full mt-1 rounded-lg shadow-lg overflow-hidden" style={{ maxHeight: 240, overflowY: 'auto' }}>
                {speakerResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-[var(--surface-hover)] transition-colors"
                    onClick={() => handleSelectSpeaker(user)}
                  >
                    <Avatar className="h-8 w-8">
                      <SiteAvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{user.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
