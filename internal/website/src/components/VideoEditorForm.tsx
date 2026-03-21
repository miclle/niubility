import { useState, useEffect, useRef, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Save, X, Plus, GripVertical, Trash2 } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import { searchUsers } from 'src/api/user'
import { useAppContext } from 'src/context/app'
import ImageUpload from 'src/components/ImageUpload'
import FileUpload from 'src/components/FileUpload'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

// VideoEditorFormProps defines the configurable behavior of the video editor form.
export interface VideoEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

// VideoItem is a local state item for the video playlist editor.
interface VideoItem {
  localId: string
  title: string
  description: string
  url: string
  fileSize: number
  duration: number
}

let videoItemCounter = 0
function newVideoItem(): VideoItem {
  return { localId: `vid_${++videoItemCounter}`, title: '', description: '', url: '', fileSize: 0, duration: 0 }
}

// SortableVideoItem renders a single draggable video item in the playlist.
function SortableVideoItem({ item, index, onChange, onRemove }: {
  item: VideoItem
  index: number
  onChange: (localId: string, field: keyof VideoItem, value: string | number) => void
  onRemove: (localId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 p-3 rounded-lg" {...attributes}>
      <button type="button" className="flex-shrink-0 cursor-grab mt-1" {...listeners}>
        <GripVertical size={16} style={{ color: '#909090' }} />
      </button>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#f2f2f2', color: '#606060' }}>
            #{index + 1}
          </span>
          <Input
            placeholder="视频标题（可选）"
            value={item.title}
            onChange={(e) => onChange(item.localId, 'title', e.target.value)}
            className="flex-1"
          />
          <button type="button" onClick={() => onRemove(item.localId)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
            <Trash2 size={14} style={{ color: '#cc0000' }} />
          </button>
        </div>
        <Input
          placeholder="视频描述（可选）"
          value={item.description}
          onChange={(e) => onChange(item.localId, 'description', e.target.value)}
        />
        <FileUpload
          accept="video/*"
          value={item.url}
          onChange={(url) => onChange(item.localId, 'url', url)}
          placeholder="拖拽视频到此处或点击选择"
          renderPreview={(url) => (
            <video src={url} controls className="max-h-36 rounded mx-auto" />
          )}
        />
      </div>
    </div>
  )
}

// VideoEditorForm is the editor form for creating/editing video content with playlist.
function VideoEditorForm({ id, defaultSpeaker, onSaved, onCancel, onLoadError }: VideoEditorFormProps) {
  const isNew = !id
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [category, setCategory] = useState<string>(categories[0]?.slug || 'learning')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [videos, setVideos] = useState<VideoItem[]>([newVideoItem()])
  const [contentStatus, setContentStatus] = useState<ContentStatus>('draft')

  // Speaker state
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerInput, setSpeakerInput] = useState('')
  const [speakerBio, setSpeakerBio] = useState('')
  const [speakerResults, setSpeakerResults] = useState<SearchUserItem[]>([])
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false)
  const speakerDropdownRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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
        setCoverUrl(c.cover_url || '')
        setCategory(c.category)
        setTags(c.tags || [])
        setContentStatus(c.status || 'published')

        if (c.attachments && c.attachments.length > 0) {
          setVideos(c.attachments.filter((m) => m.type === 'video').map((m) => ({
            localId: m.id || `vid_${++videoItemCounter}`,
            title: m.title,
            description: m.description,
            url: m.url,
            fileSize: m.file_size,
            duration: m.duration,
          })))
        }

        if (c.speaker_id && c.speaker) {
          setSpeakerId(c.speaker_id)
          setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
        } else if (c.speaker_name) {
          setSpeakerInput(c.speaker_name)
        }
        setSpeakerBio(c.speaker_bio || '')
      })
      .catch(() => onLoadError())
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpeakerInputChange = (value: string) => {
    setSpeakerInput(value)
    if (speakerId) { setSpeakerId(''); setSelectedSpeaker(null) }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value.trim()) { setSpeakerResults([]); setShowSpeakerDropdown(false); return }
    searchTimerRef.current = setTimeout(() => {
      searchUsers(value.trim()).then((res) => {
        setSpeakerResults(res.data.users)
        setShowSpeakerDropdown(res.data.users.length > 0)
      })
    }, 300)
  }

  const handleSelectSpeaker = (user: SearchUserItem) => {
    setSpeakerId(user.id); setSelectedSpeaker(user); setSpeakerInput(''); setSpeakerResults([]); setShowSpeakerDropdown(false)
  }

  const handleClearSpeaker = () => { setSpeakerId(''); setSelectedSpeaker(null); setSpeakerInput('') }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const handleVideoChange = useCallback((localId: string, field: keyof VideoItem, value: string | number) => {
    setVideos((prev) => prev.map((v) => v.localId === localId ? { ...v, [field]: value } : v))
  }, [])

  const handleRemoveVideo = useCallback((localId: string) => {
    setVideos((prev) => prev.filter((v) => v.localId !== localId))
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setVideos((prev) => {
        const oldIndex = prev.findIndex((v) => v.localId === active.id)
        const newIndex = prev.findIndex((v) => v.localId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

    setSaving(true)
    try {
      const mediaItems: CreateAttachmentArgs[] = videos.filter((v) => v.url).map((v, i) => ({
        title: v.title,
        description: v.description,
        url: v.url,
        type: 'video' as const,
        sort_order: i,
        file_size: v.fileSize,
        duration: v.duration,
      }))

      const data: CreateContentArgs = {
        title: title.trim(),
        summary: summary.trim(),
        cover_url: coverUrl.trim(),
        type: 'video',
        status,
        category,
        tags,
        speaker_id: speakerId || '',
        speaker_name: speakerId ? '' : speakerInput.trim(),
        speaker_bio: speakerBio.trim(),
        attachments: mediaItems,
      }

      if (isNew) {
        const res = await createContent(data)
        onSaved(res.data.id, status)
      } else {
        await updateContent(id!, data)
        onSaved(id!, status)
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
    <form onSubmit={(e) => e.preventDefault()} className="bg-white rounded-xl p-6 space-y-5" style={{ border: '1px solid #e5e5e5' }}>
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标题 *</label>
        <Input placeholder="请输入视频标题" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
        <Select value={category} onValueChange={(val) => val && setCategory(val)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="选择分类">
              {(value: string) => {
                const cat = categories.find((c) => c.slug === value)
                return cat?.name || value
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>摘要</label>
        <Textarea placeholder="请输入内容摘要" value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>封面图</label>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} />
      </div>

      {/* Video Playlist */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>视频列表 *</label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={videos.map((v) => v.localId)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 rounded-lg" style={{ border: '1px solid #e5e5e5' }}>
              {videos.map((video, index) => (
                <SortableVideoItem
                  key={video.localId}
                  item={video}
                  index={index}
                  onChange={handleVideoChange}
                  onRemove={handleRemoveVideo}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button type="button" variant="outline" className="mt-2" onClick={() => setVideos([...videos, newVideoItem()])}>
          <Plus size={14} />
          添加视频
        </Button>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标签</label>
        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder="输入标签后按回车或点击添加"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={handleAddTag}><Plus size={14} />添加</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-full text-xs cursor-pointer" style={{ background: '#f2f2f2', color: '#606060' }} onClick={() => setTags(tags.filter((t) => t !== tag))}>
                {tag} ×
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Speaker (admin only) */}
      {isAdmin && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人</label>
            {selectedSpeaker ? (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#f8f8f8', border: '1px solid #e5e5e5' }}>
                <Avatar size="sm">
                  <AvatarImage src={selectedSpeaker.avatar} alt={selectedSpeaker.name} />
                  <AvatarFallback>{selectedSpeaker.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1" style={{ color: '#0f0f0f' }}>{selectedSpeaker.name}</span>
                <button type="button" className="p-1 rounded-full hover:bg-gray-200 transition-colors" onClick={handleClearSpeaker}>
                  <X size={14} style={{ color: '#909090' }} />
                </button>
              </div>
            ) : (
              <div className="relative" ref={speakerDropdownRef}>
                <Input placeholder="输入主讲人姓名，可自动匹配员工" value={speakerInput} onChange={(e) => handleSpeakerInputChange(e.target.value)} onFocus={() => { if (speakerResults.length > 0) setShowSpeakerDropdown(true) }} />
                {showSpeakerDropdown && speakerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e5e5', maxHeight: 240, overflowY: 'auto' }}>
                    {speakerResults.map((user) => (
                      <button key={user.id} type="button" className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors" onClick={() => handleSelectSpeaker(user)}>
                        <Avatar size="sm">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm" style={{ color: '#0f0f0f' }}>{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人简介</label>
            <Input placeholder="主讲人简介" value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
        {(isNew || contentStatus === 'draft') ? (
          <>
            <Button type="button" variant="outline" disabled={saving || !title.trim()} onClick={() => handleSubmit('draft')}>
              <Save size={16} />
              {saving ? '保存中...' : '保存草稿'}
            </Button>
            <Button type="button" disabled={saving || !title.trim()} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              {saving ? '发布中...' : '发布'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" disabled={saving || !title.trim()} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              <Save size={16} />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => handleSubmit('draft')}>
              转为草稿
            </Button>
          </>
        )}
        <Button type="button" variant="outline" onClick={onCancel}><X size={16} />取消</Button>
      </div>
    </form>
  )
}

export default VideoEditorForm
