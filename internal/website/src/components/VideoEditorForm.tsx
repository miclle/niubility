import { useState, useEffect, useRef, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Save, X, Plus, GripVertical, Trash2, Upload, Loader2, FileText } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import { searchUsers } from 'src/api/user'
import { uploadFile, fileURL } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'
import { formatFileSize } from 'src/lib/utils'
import { newDocumentItem } from 'src/lib/document'
import { useAppContext } from 'src/context/app'
import ImageUpload from 'src/components/ImageUpload'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'
import type { DocumentItem } from 'src/lib/document'

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
  coverUrl: string
  filename: string
  mimeType: string
  checksum: string
  fileSize: number
  duration: number
  uploading: boolean
  progress: number
}

let videoItemCounter = 0
function newVideoItem(overrides?: Partial<VideoItem>): VideoItem {
  return { localId: `vid_${++videoItemCounter}`, title: '', description: '', url: '', coverUrl: '', filename: '', mimeType: '', checksum: '', fileSize: 0, duration: 0, uploading: false, progress: 0, ...overrides }
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

  // Still uploading — show progress
  if (item.uploading) {
    return (
      <div ref={setNodeRef} style={style} className="flex gap-3 p-3 rounded-lg" {...attributes}>
        <div className="flex-shrink-0 mt-1"><GripVertical size={16} style={{ color: '#d4d4d4' }} /></div>
        <div className="flex-1 flex flex-col items-center gap-2 py-4">
          <Loader2 size={24} className="animate-spin" style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>上传中 {item.progress}%</span>
          <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e5e5' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${item.progress}%`, background: '#0f0f0f' }} />
          </div>
          <span className="text-xs" style={{ color: '#b0b0b0' }}>{item.filename}</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="flex gap-3 p-3 rounded-lg" {...attributes}>
      <button type="button" className="flex-shrink-0 cursor-grab mt-1" {...listeners}>
        <GripVertical size={16} style={{ color: '#909090' }} />
      </button>
      <div className="flex-1 space-y-3">
        {/* Header with index and filename */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: '#f2f2f2', color: '#606060' }}>#{index + 1}</span>
          <span className="text-xs flex-1 truncate" style={{ color: '#909090' }}>{item.filename}</span>
          <button type="button" onClick={() => onRemove(item.localId)} className="p-1.5 rounded hover:bg-red-50 transition-colors">
            <Trash2 size={14} style={{ color: '#cc0000' }} />
          </button>
        </div>

        {/* Horizontal layout: Video | Cover | Title + Description */}
        <div className="flex gap-4">
          {/* Video preview */}
          <div className="flex-shrink-0">
            <video src={fileURL(item.url)} controls className="w-56 h-32 object-cover rounded" />
          </div>

          {/* Cover image */}
          <div className="flex-shrink-0 w-40">
            <ImageUpload value={item.coverUrl} onChange={(url) => onChange(item.localId, 'coverUrl', url)} placeholder="上传封面" />
          </div>

          {/* Title and description */}
          <div className="flex-1 space-y-2">
            <Input placeholder="视频标题（可选）" value={item.title} onChange={(e) => onChange(item.localId, 'title', e.target.value)} />
            <Textarea placeholder="视频描述（可选）" value={item.description} onChange={(e) => onChange(item.localId, 'description', e.target.value)} rows={3} />
          </div>
        </div>
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
  const [category, setCategory] = useState<string>(categories[0]?.slug || '')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
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
  const [uploadError, setUploadError] = useState('')

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
            coverUrl: m.cover_url || '',
            filename: m.filename || '',
            mimeType: m.mime_type || '',
            checksum: m.checksum || '',
            fileSize: m.file_size,
            duration: m.duration,
            uploading: false,
            progress: 0,
          })))

          setDocuments(c.attachments.filter((m) => m.type === 'document').map((m) => ({
            localId: m.id || `doc_${++documentItemCounter}`,
            title: m.title || '',
            filename: m.filename || '',
            url: m.url,
            mimeType: m.mime_type || '',
            checksum: m.checksum || '',
            fileSize: m.file_size,
            uploading: false,
            progress: 0,
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

  // handleUploadFiles uploads one or more video files, creating VideoItem entries with upload progress.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videosRef = useRef<VideoItem[]>([])
  videosRef.current = videos // Keep ref in sync with state

  const handleUploadFiles = useCallback(async (files: File[]) => {
    const videoFiles = files.filter((f) => f.type.startsWith('video/'))
    if (videoFiles.length === 0) return
    setUploadError('') // Clear previous errors

    for (const file of videoFiles) {
      try {
        // Compute checksum first to check for duplicates
        const checksum = await computeFileChecksum(file)

        // Check for duplicates in existing videos (use ref to avoid stale closure)
        const existingVideo = videosRef.current.find((v) => v.checksum === checksum && v.checksum !== '')
        if (existingVideo) {
          setUploadError(`视频 ${file.name} 与已有视频 "${existingVideo.filename}" 内容相同，已跳过`)
          continue
        }

        const item = newVideoItem({ filename: file.name, mimeType: file.type, fileSize: file.size, checksum, uploading: true })
        const localId = item.localId
        setVideos((prev) => [...prev, item])

        // Upload file
        const key = await uploadFile(file, (percent) => {
          setVideos((prev) => prev.map((v) => v.localId === localId ? { ...v, progress: percent } : v))
        })
        setVideos((prev) => prev.map((v) => v.localId === localId ? { ...v, url: key, uploading: false, progress: 100 } : v))
      } catch (err) {
        setUploadError(`视频 ${file.name} 上传失败: ${err instanceof Error ? err.message : '未知错误'}`)
      }
    }
  }, [])

  // handleDocumentUpload uploads one or more document files.
  const docInputRef = useRef<HTMLInputElement>(null)
  const handleDocumentUpload = useCallback((files: File[]) => {
    const docFiles = files.filter((f) => !f.type.startsWith('video/') && !f.type.startsWith('image/'))
    if (docFiles.length === 0) return

    for (const file of docFiles) {
      const item = newDocumentItem({ filename: file.name, mimeType: file.type, fileSize: file.size, uploading: true })
      const localId = item.localId
      setDocuments((prev) => [...prev, item])

      // Upload file and compute checksum in parallel
      Promise.all([
        uploadFile(file, (percent) => {
          setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, progress: percent } : d))
        }),
        computeFileChecksum(file),
      ]).then(([key, checksum]) => {
        setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, url: key, checksum, uploading: false, progress: 100 } : d))
      }).catch(() => {
        // Remove failed item
        setDocuments((prev) => prev.filter((d) => d.localId !== localId))
      })
    }
  }, [])

  const handleDocumentChange = useCallback((localId: string, field: keyof DocumentItem, value: string | number) => {
    setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, [field]: value } : d))
  }, [])

  const handleRemoveDocument = useCallback((localId: string) => {
    setDocuments((prev) => prev.filter((d) => d.localId !== localId))
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
        filename: v.filename,
        mime_type: v.mimeType,
        checksum: v.checksum,
        url: v.url,
        cover_url: v.coverUrl,
        type: 'video' as const,
        sort_order: i,
        file_size: v.fileSize,
        duration: v.duration,
      }))

      // Add document attachments
      const documentItems: CreateAttachmentArgs[] = documents.filter((d) => d.url).map((d, i) => ({
        title: d.title || d.filename,
        filename: d.filename,
        mime_type: d.mimeType,
        checksum: d.checksum,
        url: d.url,
        type: 'document' as const,
        sort_order: mediaItems.length + i,
        file_size: d.fileSize,
      }))

      const allAttachments = [...mediaItems, ...documentItems]

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
        attachments: allAttachments,
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
      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
          <Select value={category} onValueChange={(val) => val && setCategory(val)}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left">
                {category ? categories.find((c) => c.slug === category)?.name || category : '选择分类'}
              </span>
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

      {/* Video Upload Area */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>上传视频 *</label>
        {uploadError && (
          <div className="text-xs mb-2 p-2 rounded" style={{ color: '#cc0000', background: '#fff0f0' }}>{uploadError}</div>
        )}
        <div
          className="rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-8"
          style={{ border: '2px dashed #d4d4d4', background: '#fafafa' }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUploadFiles(Array.from(e.dataTransfer.files)) }}
        >
          <Upload size={24} style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>拖拽视频到此处或点击选择，支持多个文件</span>
        </div>
        <input ref={fileInputRef} type="file" accept="video/*" multiple onChange={(e) => { if (e.target.files) handleUploadFiles(Array.from(e.target.files)); e.target.value = '' }} className="hidden" />
      </div>

      {/* Video List */}
      {videos.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>视频列表</label>
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
        </div>
      )}

      {/* Document Attachments */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>资料附件</label>
        <div
          className="rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6"
          style={{ border: '2px dashed #d4d4d4', background: '#fafafa' }}
          onClick={() => docInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleDocumentUpload(Array.from(e.dataTransfer.files)) }}
        >
          <FileText size={20} style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>拖拽文件到此处或点击选择（PDF, PPT, DOC, XLS, TXT等）</span>
        </div>
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md"
          multiple
          onChange={(e) => { if (e.target.files) handleDocumentUpload(Array.from(e.target.files)); e.target.value = '' }}
          className="hidden"
        />
        {documents.length > 0 && (
          <div className="mt-3 space-y-2">
            {documents.map((doc) => (
              <div key={doc.localId} className="flex items-center gap-3 p-3 rounded-lg" style={{ border: '1px solid #e5e5e5' }}>
                <FileText size={20} style={{ color: '#909090' }} />
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="文件标题（可选）"
                    value={doc.title}
                    onChange={(e) => handleDocumentChange(doc.localId, 'title', e.target.value)}
                    className="mb-1"
                  />
                  <div className="text-xs truncate" style={{ color: '#909090' }}>
                    {doc.filename} {doc.fileSize > 0 && `(${formatFileSize(doc.fileSize)})`}
                  </div>
                  {doc.uploading && (
                    <div className="w-full h-1 rounded-full overflow-hidden mt-2" style={{ background: '#e5e5e5' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${doc.progress}%`, background: '#0f0f0f' }} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDocument(doc.localId)}
                  className="p-1.5 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} style={{ color: '#cc0000' }} />
                </button>
              </div>
            ))}
          </div>
        )}
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
            <Button type="button" variant="outline" disabled={saving || !title.trim() || videos.some((v) => v.uploading) || documents.some((d) => d.uploading)} onClick={() => handleSubmit('draft')}>
              <Save size={16} />
              {saving ? '保存中...' : '保存草稿'}
            </Button>
            <Button type="button" disabled={saving || !title.trim() || videos.some((v) => v.uploading) || documents.some((d) => d.uploading)} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              {saving ? '发布中...' : '发布'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" disabled={saving || !title.trim() || videos.some((v) => v.uploading) || documents.some((d) => d.uploading)} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              <Save size={16} />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button type="button" variant="outline" disabled={saving || videos.some((v) => v.uploading) || documents.some((d) => d.uploading)} onClick={() => handleSubmit('draft')}>
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
