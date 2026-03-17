import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Save, X, Plus, Search, UserRound } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import { searchUsers } from 'src/api/user'
import type { ContentType, ContentCategory, CreateContentArgs } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

// ContentEditorFormProps defines the configurable behavior of the editor form.
export interface ContentEditorFormProps {
  // Content ID for editing; undefined for creating.
  id?: string
  // Default speaker to pre-select when creating new content.
  defaultSpeaker?: SearchUserItem
  // Navigation target after successful save. Receives the content ID.
  onSaved: (contentId: string) => void
  // Navigation target when cancel is clicked.
  onCancel: () => void
  // Navigation target when loading existing content fails.
  onLoadError: () => void
  // Submit button label (e.g., "发布" or "保存").
  submitLabel?: string
}

// ContentEditorForm is the shared form for creating or editing content.
function ContentEditorForm({ id, defaultSpeaker, onSaved, onCancel, onLoadError, submitLabel = '保存' }: ContentEditorFormProps) {
  const navigate = useNavigate()
  const isNew = !id

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [type, setType] = useState<ContentType>('article')
  const [category, setCategory] = useState<ContentCategory>('learning')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Speaker state — optionally default to provided speaker for new content
  const [speakerMode, setSpeakerMode] = useState<'employee' | 'manual'>('employee')
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerName, setSpeakerName] = useState('')
  const [speakerBio, setSpeakerBio] = useState('')
  const [speakerSearch, setSpeakerSearch] = useState('')
  const [speakerResults, setSpeakerResults] = useState<SearchUserItem[]>([])
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false)
  const speakerDropdownRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

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

  // Load existing content for editing
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        const c = res.data
        setTitle(c.title)
        setSummary(c.summary || '')
        setBody(c.body || '')
        setCoverUrl(c.cover_url || '')
        setVideoUrl(c.video_url || '')
        setType(c.type)
        setCategory(c.category)
        setTags(c.tags || [])

        if (c.speaker_id && c.speaker) {
          setSpeakerMode('employee')
          setSpeakerId(c.speaker_id)
          setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
        } else if (c.speaker_name) {
          setSpeakerMode('manual')
          setSpeakerName(c.speaker_name)
          setSpeakerBio(c.speaker_bio || '')
        }
      })
      .catch(() => onLoadError())
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Search users with debounce
  const handleSpeakerSearchChange = (value: string) => {
    setSpeakerSearch(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!value.trim()) {
      setSpeakerResults([])
      setShowSpeakerDropdown(false)
      return
    }

    searchTimerRef.current = setTimeout(() => {
      searchUsers(value.trim()).then((res) => {
        setSpeakerResults(res.data.users)
        setShowSpeakerDropdown(true)
      })
    }, 300)
  }

  const handleSelectSpeaker = (user: SearchUserItem) => {
    setSpeakerId(user.id)
    setSelectedSpeaker(user)
    setSpeakerSearch('')
    setSpeakerResults([])
    setShowSpeakerDropdown(false)
    setSpeakerName('')
    setSpeakerBio('')
  }

  const handleClearSpeaker = () => {
    setSpeakerId('')
    setSelectedSpeaker(null)
  }

  const handleSwitchMode = (mode: 'employee' | 'manual') => {
    setSpeakerMode(mode)
    if (mode === 'employee') {
      setSpeakerName('')
      setSpeakerBio('')
    } else {
      setSpeakerId('')
      setSelectedSpeaker(null)
      setSpeakerSearch('')
    }
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const data: CreateContentArgs = {
        title: title.trim(),
        summary: summary.trim(),
        body,
        cover_url: coverUrl.trim(),
        video_url: videoUrl.trim(),
        type,
        category,
        tags,
        speaker_id: speakerMode === 'employee' ? speakerId : '',
        speaker_name: speakerMode === 'manual' ? speakerName.trim() : '',
        speaker_bio: speakerMode === 'manual' ? speakerBio.trim() : '',
      }

      if (isNew) {
        const res = await createContent(data)
        onSaved(res.data.id)
      } else {
        await updateContent(id!, data)
        onSaved(id!)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl p-6 space-y-5"
      style={{ border: '1px solid #e5e5e5' }}
    >
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标题 *</label>
        <Input
          placeholder="请输入标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Type & Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>类型 *</label>
          <Select value={type} onValueChange={(val) => setType(val as ContentType)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="article">图文</SelectItem>
              <SelectItem value="video">视频</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
          <Select value={category} onValueChange={(val) => setCategory(val as ContentCategory)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="learning">学习交流</SelectItem>
              <SelectItem value="culture">企业文化</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>摘要</label>
        <Textarea
          placeholder="请输入内容摘要"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={2}
        />
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>正文</label>
        <Textarea
          placeholder="请输入正文内容（支持 HTML）"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
        />
      </div>

      {/* Cover URL */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>封面图 URL</label>
        <Input
          placeholder="https://example.com/cover.jpg"
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />
      </div>

      {/* Video URL */}
      {type === 'video' && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>视频 URL</label>
          <Input
            placeholder="https://example.com/video.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
          />
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标签</label>
        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder="输入标签后按回车或点击添加"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={handleAddTag}>
            <Plus size={14} />
            添加
          </Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 rounded-full text-xs cursor-pointer"
                style={{ background: '#f2f2f2', color: '#606060' }}
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} ×
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Speaker */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium" style={{ color: '#606060' }}>主讲人</label>
          <div className="flex gap-1">
            <button
              type="button"
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: speakerMode === 'employee' ? '#0f0f0f' : '#f2f2f2',
                color: speakerMode === 'employee' ? '#ffffff' : '#606060',
              }}
              onClick={() => handleSwitchMode('employee')}
            >
              选择员工
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                background: speakerMode === 'manual' ? '#0f0f0f' : '#f2f2f2',
                color: speakerMode === 'manual' ? '#ffffff' : '#606060',
              }}
              onClick={() => handleSwitchMode('manual')}
            >
              手动输入
            </button>
          </div>
        </div>

        {speakerMode === 'employee' ? (
          <div>
            {selectedSpeaker ? (
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{ background: '#f8f8f8', border: '1px solid #e5e5e5' }}
              >
                <Avatar size="sm">
                  <AvatarImage src={selectedSpeaker.avatar} alt={selectedSpeaker.name} />
                  <AvatarFallback>{selectedSpeaker.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1" style={{ color: '#0f0f0f' }}>
                  {selectedSpeaker.name}
                </span>
                <button
                  type="button"
                  className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                  onClick={handleClearSpeaker}
                >
                  <X size={14} style={{ color: '#909090' }} />
                </button>
              </div>
            ) : (
              <div className="relative" ref={speakerDropdownRef}>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#909090' }} />
                  <Input
                    placeholder="搜索员工姓名..."
                    value={speakerSearch}
                    onChange={(e) => handleSpeakerSearchChange(e.target.value)}
                    onFocus={() => { if (speakerResults.length > 0) setShowSpeakerDropdown(true) }}
                    className="pl-9"
                  />
                </div>
                {showSpeakerDropdown && speakerResults.length > 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded-lg shadow-lg overflow-hidden"
                    style={{ background: '#ffffff', border: '1px solid #e5e5e5', maxHeight: 240, overflowY: 'auto' }}
                  >
                    {speakerResults.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                        onClick={() => handleSelectSpeaker(user)}
                      >
                        <Avatar size="sm">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm" style={{ color: '#0f0f0f' }}>{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showSpeakerDropdown && speakerSearch.trim() && speakerResults.length === 0 && (
                  <div
                    className="absolute z-10 w-full mt-1 rounded-lg shadow-lg p-4 text-center"
                    style={{ background: '#ffffff', border: '1px solid #e5e5e5' }}
                  >
                    <UserRound size={24} className="mx-auto mb-2" style={{ color: '#c0c0c0' }} />
                    <div className="text-sm" style={{ color: '#909090' }}>未找到匹配的员工</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="主讲人姓名"
              value={speakerName}
              onChange={(e) => setSpeakerName(e.target.value)}
            />
            <Input
              placeholder="主讲人简介"
              value={speakerBio}
              onChange={(e) => setSpeakerBio(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
        <Button
          type="submit"
          disabled={saving || !title.trim()}
          style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
        >
          <Save size={16} />
          {saving ? '保存中...' : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X size={16} />
          取消
        </Button>
      </div>
    </form>
  )
}

export default ContentEditorForm
