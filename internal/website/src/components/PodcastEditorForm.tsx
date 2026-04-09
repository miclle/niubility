import { useState, useRef, useCallback } from 'react'
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

// PodcastEditorFormProps defines the configurable behavior of the podcast editor form.
export interface PodcastEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

// AudioItem is a local state item for the podcast audio editor.
interface AudioItem {
  localId: string
  title: string
  description: string
  url: string
  filename: string
  mimeType: string
  checksum: string
  fileSize: number
  duration: number
  uploading: boolean
  progress: number
}

let audioItemCounter = 0
function newAudioItem(overrides?: Partial<AudioItem>): AudioItem {
  return { localId: `aud_${++audioItemCounter}`, title: '', description: '', url: '', filename: '', mimeType: '', checksum: '', fileSize: 0, duration: 0, uploading: false, progress: 0, ...overrides }
}

// SortableAudioItem renders a single draggable audio item in the playlist.
function SortableAudioItem({ item, index, onChange, onRemove }: {
  item: AudioItem
  index: number
  onChange: (localId: string, field: keyof AudioItem, value: string | number) => void
  onRemove: (localId: string) => void
}) {
  const { t } = useTranslation('editor')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  // Still uploading — show progress
  if (item.uploading) {
    return (
      <div ref={setNodeRef} style={style} className="flex gap-3 p-3 rounded-lg" {...attributes}>
        <div className="flex-shrink-0 mt-1"><GripVertical size={16} style={{ color: '#d4d4d4' }} /></div>
        <div className="flex-1 flex flex-col items-center gap-2 py-4">
          <Loader2 size={24} className="animate-spin" style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>{t('uploading')} {item.progress}%</span>
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

        {/* Title and description */}
        <div className="space-y-2">
          <Input placeholder={t('audioTitleOptional')} value={item.title} onChange={(e) => onChange(item.localId, 'title', e.target.value)} />
          <Textarea placeholder={t('audioDescriptionOptional')} value={item.description} onChange={(e) => onChange(item.localId, 'description', e.target.value)} rows={2} />
        </div>
      </div>
    </div>
  )
}

// PodcastEditorForm is the editor form for creating/editing podcast content with audio episodes.
function PodcastEditorForm({ id, defaultSpeaker, onSaved, onCancel, onLoadError }: PodcastEditorFormProps) {
  const { t } = useTranslation('editor')
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [summary, setSummary] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [audioItems, setAudioItems] = useState<AudioItem[]>([])
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
      setAudioItems(c.attachments.filter((m) => m.type === 'audio').map((m) => ({
        localId: m.id || `aud_${++audioItemCounter}`,
        title: m.title,
        description: m.description,
        url: m.url,
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

  const handleAudioChange = useCallback((localId: string, field: keyof AudioItem, value: string | number) => {
    setAudioItems((prev) => prev.map((a) => a.localId === localId ? { ...a, [field]: value } : a))
  }, [])

  const handleRemoveAudio = useCallback((localId: string) => {
    setAudioItems((prev) => prev.filter((a) => a.localId !== localId))
  }, [])

  // handleUploadFiles uploads one or more audio files, creating AudioItem entries with upload progress.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioItemsRef = useRef<AudioItem[]>([])
  audioItemsRef.current = audioItems

  const handleUploadFiles = useCallback(async (files: File[]) => {
    const audioFiles = files.filter((f) => f.type.startsWith('audio/'))
    if (audioFiles.length === 0) return
    setUploadError('')

    for (const file of audioFiles) {
      try {
        const checksum = await computeFileChecksum(file)

        const existingAudio = audioItemsRef.current.find((a) => a.checksum === checksum && a.checksum !== '')
        if (existingAudio) {
          setUploadError(t('audioExistsSkipped', { filename: file.name, existing: existingAudio.filename }))
          continue
        }

        const item = newAudioItem({ filename: file.name, mimeType: file.type, fileSize: file.size, checksum, uploading: true })
        const localId = item.localId
        setAudioItems((prev) => [...prev, item])

        const key = await uploadFile(file, (percent) => {
          setAudioItems((prev) => prev.map((a) => a.localId === localId ? { ...a, progress: percent } : a))
        })
        setAudioItems((prev) => prev.map((a) => a.localId === localId ? { ...a, url: key, uploading: false, progress: 100 } : a))
      } catch (err) {
        setUploadError(t('audioUploadFailed', { filename: file.name, error: err instanceof Error ? err.message : 'Unknown error' }))
      }
    }
  }, [t])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setAudioItems((prev) => {
        const oldIndex = prev.findIndex((a) => a.localId === active.id)
        const newIndex = prev.findIndex((a) => a.localId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

    const audioAttachments: CreateAttachmentArgs[] = audioItems.filter((a) => a.url).map((a, i) => ({
      title: a.title,
      description: a.description,
      filename: a.filename,
      mime_type: a.mimeType,
      checksum: a.checksum,
      url: a.url,
      type: 'audio' as const,
      sort_order: i,
      file_size: a.fileSize,
      duration: a.duration,
    }))

    const documentItems: CreateAttachmentArgs[] = documents.filter((d) => d.url).map((d, i) => ({
      title: d.title || d.filename,
      filename: d.filename,
      mime_type: d.mimeType,
      checksum: d.checksum,
      url: d.url,
      type: 'document' as const,
      sort_order: audioAttachments.length + i,
      file_size: d.fileSize,
    }))

    const allAttachments = [...audioAttachments, ...documentItems]

    const data: CreateContentArgs = {
      title: title.trim(),
      summary: summary.trim(),
      cover_url: coverUrl.trim(),
      type: 'podcast',
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
    return <div className="text-center py-20" style={{ color: '#909090' }}>{t('loading')}</div>
  }

  const hasUploading = audioItems.some((a) => a.uploading) || documents.some((d) => d.uploading)

  return (
    <form onSubmit={(e) => e.preventDefault()} className="bg-white rounded-xl p-6 space-y-5" style={{ border: '1px solid #e5e5e5' }}>
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('title')} *</label>
        <Input placeholder={t('titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('category')} *</label>
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
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('description')}</label>
        <Textarea placeholder={t('descriptionPlaceholder')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} />
      </div>

      {/* Cover Image */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('cover')}</label>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} />
      </div>

      {/* Audio Upload Area */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('uploadAudio')} *</label>
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
          <span className="text-sm" style={{ color: '#909090' }}>{t('uploadAudioHint')}</span>
        </div>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple onChange={(e) => { if (e.target.files) handleUploadFiles(Array.from(e.target.files)); e.target.value = '' }} className="hidden" />
      </div>

      {/* Audio List */}
      {audioItems.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('audioList')}</label>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={audioItems.map((a) => a.localId)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 rounded-lg" style={{ border: '1px solid #e5e5e5' }}>
                {audioItems.map((audio, index) => (
                  <SortableAudioItem
                    key={audio.localId}
                    item={audio}
                    index={index}
                    onChange={handleAudioChange}
                    onRemove={handleRemoveAudio}
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
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>{t('speakerBio')}</label>
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

export default PodcastEditorForm
