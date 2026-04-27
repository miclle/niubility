import { useState, useRef, useCallback, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { GripVertical, Trash2, Upload, Loader2 } from 'lucide-react'

import { uploadFile } from 'src/api/upload'
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

// MediaItem is a unified local state item for both video and audio playlist editors.
export interface MediaItem {
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

// MediaEditorConfig defines the type-specific configuration for the media editor.
export interface MediaEditorConfig {
  contentType: 'video' | 'podcast'
  mediaType: 'video' | 'audio'
  accept: string
  idPrefix: string
  uploadLabelKey: string
  uploadHintKey: string
  listLabelKey: string
  existsSkippedKey: string
  uploadFailedKey: string
}

// RenderItemContentProps are passed to the render prop for type-specific item content.
export interface RenderItemContentProps {
  item: MediaItem
  index: number
  onChange: (localId: string, field: keyof MediaItem, value: string | number) => void
}

// MediaEditorFormProps defines the configurable behavior of the media editor form.
export interface MediaEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  config: MediaEditorConfig
  renderItemContent: (props: RenderItemContentProps) => ReactNode
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

let mediaItemCounter = 0

// newMediaItem creates a new MediaItem with defaults and optional overrides.
function newMediaItem(idPrefix: string, overrides?: Partial<MediaItem>): MediaItem {
  return {
    localId: `${idPrefix}_${++mediaItemCounter}`,
    title: '', description: '', url: '', coverUrl: '',
    filename: '', mimeType: '', checksum: '',
    fileSize: 0, duration: 0, uploading: false, progress: 0,
    ...overrides,
  }
}

// SortableMediaItem renders a single draggable media item with shared uploading UI.
function SortableMediaItem({ item, index, onChange, onRemove, renderContent }: {
  item: MediaItem
  index: number
  onChange: (localId: string, field: keyof MediaItem, value: string | number) => void
  onRemove: (localId: string) => void
  renderContent: (props: RenderItemContentProps) => ReactNode
}) {
  const { t } = useTranslation('editor')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  // Still uploading — show progress
  if (item.uploading) {
    return (
      <div ref={setNodeRef} style={style} className="app-surface-muted flex gap-3 p-3 rounded-lg" {...attributes}>
        <div className="flex-shrink-0 mt-1"><GripVertical size={16} className="text-[var(--surface-border)]" /></div>
        <div className="flex-1 flex flex-col items-center gap-2 py-4">
          <Loader2 size={24} className="app-text-tertiary animate-spin" />
          <span className="app-text-tertiary text-sm">{t('uploading')} {item.progress}%</span>
          <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden bg-[var(--surface-border)]">
            <div className="h-full rounded-full transition-all bg-foreground" style={{ width: `${item.progress}%` }} />
          </div>
          <span className="app-text-tertiary text-xs">{item.filename}</span>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="app-surface-muted flex gap-3 p-3 rounded-lg" {...attributes}>
      <button type="button" className="flex-shrink-0 cursor-grab mt-1" {...listeners}>
        <GripVertical size={16} className="app-text-tertiary" />
      </button>
      <div className="flex-1 space-y-3">
        {/* Header with index and filename */}
        <div className="flex items-center gap-2">
          <span className="app-chip text-xs font-medium px-2 py-0.5 rounded">#{index + 1}</span>
          <span className="app-text-tertiary text-xs flex-1 truncate">{item.filename}</span>
          <button type="button" onClick={() => onRemove(item.localId)} className="p-1.5 rounded hover:bg-red-500/10 transition-colors">
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        </div>

        {/* Type-specific content rendered via prop */}
        {renderContent({ item, index, onChange })}
      </div>
    </div>
  )
}

// MediaEditorForm is a unified editor form for video/podcast content with media playlists.
function MediaEditorForm({ id, defaultSpeaker, config, renderItemContent, onSaved, onCancel, onLoadError }: MediaEditorFormProps) {
  const { t } = useTranslation('editor')
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [summary, setSummary] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const { documents, docInputRef, handleDocumentUpload, handleDocumentChange, handleRemoveDocument, loadDocuments } = useDocumentUpload()

  // Speaker state
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
      setMediaItems(c.attachments.filter((m) => m.type === config.mediaType).map((m) => ({
        localId: m.id || `${config.idPrefix}_${++mediaItemCounter}`,
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

    setSpeakerId(c.speaker_id || '')
    if (c.speaker) {
      setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
    } else if (c.speaker_name) {
      setSelectedSpeaker({ id: '', name: c.speaker_name, avatar: '' })
    } else {
      setSelectedSpeaker(null)
    }
    setSpeakerBio(c.speaker_bio || '')
  }, [config.mediaType, config.idPrefix, loadDocuments])

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

  const handleItemChange = useCallback((localId: string, field: keyof MediaItem, value: string | number) => {
    setMediaItems((prev) => prev.map((item) => item.localId === localId ? { ...item, [field]: value } : item))
  }, [])

  const handleRemoveItem = useCallback((localId: string) => {
    setMediaItems((prev) => prev.filter((item) => item.localId !== localId))
  }, [])

  // handleUploadFiles uploads one or more media files, creating MediaItem entries with upload progress.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaItemsRef = useRef<MediaItem[]>([])
  mediaItemsRef.current = mediaItems // Keep ref in sync with state

  const handleUploadFiles = useCallback(async (files: File[]) => {
    const mediaFiles = files.filter((f) => f.type.startsWith(`${config.mediaType}/`))
    if (mediaFiles.length === 0) return
    setUploadError('') // Clear previous errors

    for (const file of mediaFiles) {
      try {
        // Compute checksum first to check for duplicates
        const checksum = await computeFileChecksum(file)

        // Check for duplicates in existing items (use ref to avoid stale closure)
        const existingItem = mediaItemsRef.current.find((item) => item.checksum === checksum && item.checksum !== '')
        if (existingItem) {
          setUploadError(t(config.existsSkippedKey, { filename: file.name, existing: existingItem.filename }))
          continue
        }

        const item = newMediaItem(config.idPrefix, { filename: file.name, mimeType: file.type, fileSize: file.size, checksum, uploading: true })
        const localId = item.localId
        setMediaItems((prev) => [...prev, item])

        // Upload file
        const key = await uploadFile(file, (percent) => {
          setMediaItems((prev) => prev.map((m) => m.localId === localId ? { ...m, progress: percent } : m))
        })
        setMediaItems((prev) => prev.map((m) => m.localId === localId ? { ...m, url: key, uploading: false, progress: 100 } : m))
      } catch (err) {
        setUploadError(t(config.uploadFailedKey, { filename: file.name, error: err instanceof Error ? err.message : 'Unknown error' }))
      }
    }
  }, [t, config.mediaType, config.idPrefix, config.existsSkippedKey, config.uploadFailedKey])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setMediaItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.localId === active.id)
        const newIndex = prev.findIndex((item) => item.localId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

    const mediaAttachments: CreateAttachmentArgs[] = mediaItems.filter((m) => m.url).map((m, i) => ({
      title: m.title,
      description: m.description,
      filename: m.filename,
      mime_type: m.mimeType,
      checksum: m.checksum,
      url: m.url,
      cover_url: m.coverUrl || undefined,
      type: config.mediaType as 'video' | 'audio',
      sort_order: i,
      file_size: m.fileSize,
      duration: m.duration,
    }))

    // Add document attachments
    const documentItems: CreateAttachmentArgs[] = documents.filter((d) => d.url).map((d, i) => ({
      title: d.title || d.filename,
      filename: d.filename,
      mime_type: d.mimeType,
      checksum: d.checksum,
      url: d.url,
      type: 'document' as const,
      sort_order: mediaAttachments.length + i,
      file_size: d.fileSize,
    }))

    const allAttachments = [...mediaAttachments, ...documentItems]

    const data: CreateContentArgs = {
      title: title.trim(),
      summary: summary.trim(),
      cover_url: coverUrl.trim(),
      type: config.contentType,
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
    return <div className="app-text-tertiary text-center py-20">{t('loading')}</div>
  }

  const hasUploading = mediaItems.some((m) => m.uploading) || documents.some((d) => d.uploading)

  return (
    <form onSubmit={(e) => e.preventDefault()} className="app-surface-elevated border app-border rounded-xl p-6 space-y-5" data-testid="media-editor-form">
      {/* Title */}
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('title')} *</label>
        <Input placeholder={t('titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('category')} *</label>
          <Select value={category} onValueChange={(val) => val && setCategory(val)}>
            <SelectTrigger className="w-full">
              <span className="flex-1 text-left">
                {category ? categories.find((c) => c.slug === category)?.name || category : t('categoryPlaceholder')}
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
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('description')}</label>
        <Textarea placeholder={t('descriptionPlaceholder')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
      </div>

      {/* Cover Image */}
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('cover')}</label>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} />
      </div>

      {/* Media Upload Area */}
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t(config.uploadLabelKey)} *</label>
        {uploadError && (
          <div className="theme-danger-banner text-xs mb-2 p-2 rounded">{uploadError}</div>
        )}
        <div
          className="app-surface-muted border-2 border-dashed app-border rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-8"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleUploadFiles(Array.from(e.dataTransfer.files)) }}
        >
          <Upload size={24} className="app-text-tertiary" />
          <span className="app-text-tertiary text-sm">{t(config.uploadHintKey)}</span>
        </div>
        <input ref={fileInputRef} type="file" accept={config.accept} multiple onChange={(e) => { if (e.target.files) handleUploadFiles(Array.from(e.target.files)); e.target.value = '' }} className="hidden" />
      </div>

      {/* Media List */}
      {mediaItems.length > 0 && (
        <div>
          <label className="app-text-secondary block text-sm font-medium mb-1.5">{t(config.listLabelKey)}</label>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={mediaItems.map((m) => m.localId)} strategy={verticalListSortingStrategy}>
              <div className="app-surface-elevated border app-border space-y-2 rounded-lg p-2">
                {mediaItems.map((item, index) => (
                  <SortableMediaItem
                    key={item.localId}
                    item={item}
                    index={index}
                    onChange={handleItemChange}
                    onRemove={handleRemoveItem}
                    renderContent={renderItemContent}
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
      <TagInput tags={tags} onChange={setTags} label={t('tags')} />

      {/* Speaker (admin only) */}
      {isAdmin && (
        <div className="space-y-3">
          <SpeakerSelector
            defaultSpeaker={selectedSpeaker || undefined}
            onChange={handleSpeakerChange}
            label={t('speaker')}
          />
          <div>
            <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('speakerBio')}</label>
            <Input placeholder={t('speakerBioPlaceholder')} value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)} />
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

export default MediaEditorForm
