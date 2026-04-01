import { useState, useRef, useCallback } from 'react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { GripVertical, Trash2, Upload, Loader2 } from 'lucide-react'

import { uploadFile, fileURL } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'
import { useAppContext } from 'src/context/app'
import { useContentEditor } from 'src/hooks/useContentEditor'
import { useDocumentUpload } from 'src/hooks/useDocumentUpload'
import ImageUpload from 'src/components/ImageUpload'
import SpeakerSelector from 'src/components/SpeakerSelector'
import TagInput from 'src/components/TagInput'
import DocumentUploadSection from 'src/components/DocumentUploadSection'
import EditorActions from 'src/components/EditorActions'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs } from 'src/types/content'
import type { Content } from 'src/types/content'
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
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [summary, setSummary] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [videos, setVideos] = useState<VideoItem[]>([])
  const { documents, docInputRef, handleDocumentUpload, handleDocumentChange, handleRemoveDocument, loadDocuments } = useDocumentUpload()

  // Speaker state (simplified)
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerBio, setSpeakerBio] = useState('')

  const [uploadError, setUploadError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Load type-specific fields from existing content
  const handleLoad = useCallback((c: Content) => {
    setSummary(c.summary || '')
    setCoverUrl(c.cover_url || '')

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

      loadDocuments(c.attachments)
    }

    if (c.speaker_id && c.speaker) {
      setSpeakerId(c.speaker_id)
      setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
    }
    setSpeakerBio(c.speaker_bio || '')
  }, [loadDocuments])

  const {
    isNew, loading, saving,
    title, setTitle,
    category, setCategory,
    tags, setTags,
    contentStatus, save,
  } = useContentEditor({ id, onLoadError }, handleLoad)

  const handleSpeakerChange = (speaker: SearchUserItem | null) => {
    setSpeakerId(speaker?.id || '')
    setSelectedSpeaker(speaker)
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
      speaker_name: speakerId ? '' : (selectedSpeaker?.name || ''),
      speaker_bio: speakerBio.trim(),
      attachments: allAttachments,
    }

    const contentId = await save(data)
    if (contentId) onSaved(contentId, status)
  }

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>
  }

  const hasUploading = videos.some((v) => v.uploading) || documents.some((d) => d.uploading)

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
      <DocumentUploadSection documents={documents} docInputRef={docInputRef} onUpload={handleDocumentUpload} onChange={handleDocumentChange} onRemove={handleRemoveDocument} />

      {/* Tags */}
      <TagInput tags={tags} onChange={setTags} label="标签" />

      {/* Speaker (admin only) */}
      {isAdmin && (
        <div className="space-y-3">
          <SpeakerSelector
            defaultSpeaker={selectedSpeaker || undefined}
            onChange={handleSpeakerChange}
            label="主讲人"
          />
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人简介</label>
            <Input placeholder="主讲人简介" value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)} />
          </div>
        </div>
      )}

      {/* Actions */}
      <EditorActions
        saving={saving}
        isNew={isNew}
        contentStatus={contentStatus}
        disabled={!title.trim() || hasUploading}
        onSave={handleSubmit}
        onCancel={onCancel}
      />
    </form>
  )
}

export default VideoEditorForm
