import { useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Plus, GripVertical, Trash2, Star, Upload, Loader2 } from 'lucide-react'

import { uploadFile, fileURL } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'
import { useAppContext } from 'src/context/app'
import { useContentEditor } from 'src/hooks/useContentEditor'
import EditorActions from 'src/components/EditorActions'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs, AttachmentType } from 'src/types/content'
import type { Content } from 'src/types/content'

// GalleryEditorFormProps defines the configurable behavior of the gallery editor form.
export interface GalleryEditorFormProps {
  id?: string
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

// GalleryItem is a local state item for gallery media management.
interface GalleryItem {
  localId: string
  url: string
  filename: string
  mimeType: string
  checksum: string
  type: AttachmentType
  isCover: boolean
  width: number
  height: number
  fileSize: number
  duration: number
}

let galleryItemCounter = 0

// GalleryVideoMaxDuration is the max duration for gallery videos (seconds).
const GALLERY_VIDEO_MAX_DURATION = 120
// GalleryVideoMaxSize is the max file size for gallery videos (bytes).
const GALLERY_VIDEO_MAX_SIZE = 200 * 1024 * 1024

// SortableGalleryItem renders a single draggable gallery item.
function SortableGalleryItem({ item, onRemove, onSetCover }: {
  item: GalleryItem
  onRemove: (localId: string) => void
  onSetCover: (localId: string) => void
}) {
  const { t } = useTranslation('editor')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  const resolvedUrl = fileURL(item.url)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative rounded-lg overflow-hidden group"
      {...attributes}
    >
      <div className="aspect-square bg-zinc-100">
        {item.type === 'video' ? (
          <video src={resolvedUrl} className="w-full h-full object-cover" muted />
        ) : (
          <img src={resolvedUrl} alt="" className="w-full h-full object-cover" />
        )}
      </div>
      {/* Overlay controls */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-start justify-between p-1.5">
        <button type="button" className="cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" {...listeners}>
          <GripVertical size={16} className="text-white drop-shadow" />
        </button>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onSetCover(item.localId)}
            className="p-1 rounded-full transition-colors"
            style={{ background: item.isCover ? '#f59e0b' : 'rgba(0,0,0,0.5)' }}
            title={item.isCover ? t('currentCover') : t('setAsCover')}
          >
            <Star size={12} fill={item.isCover ? 'white' : 'none'} className="text-white" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.localId)}
            className="p-1 rounded-full transition-colors"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <Trash2 size={12} className="text-white" />
          </button>
        </div>
      </div>
      {item.isCover && (
        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: '#f59e0b', color: 'white' }}>
          {t('cover')}
        </div>
      )}
      {item.type === 'video' && (
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(0,0,0,0.7)', color: 'white' }}>
          {t('video')}
        </div>
      )}
    </div>
  )
}

// GalleryEditorForm is the editor form for creating/editing gallery (image/short-video) content.
function GalleryEditorForm({ id, onSaved, onCancel, onLoadError }: GalleryEditorFormProps) {
  const { t } = useTranslation('editor')
  const { categories } = useAppContext()

  const [summary, setSummary] = useState('')
  const [items, setItems] = useState<GalleryItem[]>([])
  const [tagInput, setTagInput] = useState('')

  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Load type-specific fields from existing content
  const handleLoad = useCallback((c: Content) => {
    setSummary(c.summary || '')

    if (c.attachments && c.attachments.length > 0) {
      setItems(c.attachments.map((m) => ({
        localId: m.id || `gal_${++galleryItemCounter}`,
        url: m.url,
        filename: m.filename || '',
        mimeType: m.mime_type || '',
        checksum: m.checksum || '',
        type: m.type,
        isCover: m.is_cover,
        width: m.width || 0,
        height: m.height || 0,
        fileSize: m.file_size,
        duration: m.duration,
      })))
    }
  }, [])

  const {
    isNew, loading, saving,
    title, setTitle,
    category, setCategory,
    tags, setTags,
    contentStatus, save,
  } = useContentEditor({ id, onLoadError }, handleLoad)

  // Set initial category from loaded categories
  const [categoryInitialized, setCategoryInitialized] = useState(false)
  if (!categoryInitialized && !id && categories.length > 0 && !category) {
    setCategory(categories[0]?.slug || '')
    setCategoryInitialized(true)
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const handleFilesSelected = useCallback(async (files: FileList) => {
    setUploadError('')
    setUploading(true)

    const fileArr = Array.from(files)
    for (const file of fileArr) {
      const isVideo = file.type.startsWith('video/')
      const mediaType: AttachmentType = isVideo ? 'video' : 'image'

      if (isVideo && file.size > GALLERY_VIDEO_MAX_SIZE) {
        setUploadError(t('galleryFileSizeExceeded', { filename: file.name }))
        continue
      }

      try {
        // Compute checksum and check for duplicates before uploading
        const checksum = await computeFileChecksum(file)
        const isDuplicate = await new Promise<boolean>((resolve) => {
          setItems((prev) => { resolve(prev.some((i) => i.checksum === checksum)); return prev })
        })
        if (isDuplicate) {
          setUploadError(t('galleryFileExists', { filename: file.name }))
          continue
        }

        const url = await uploadFile(file)
        const localId = `gal_${++galleryItemCounter}`
        const newItem: GalleryItem = {
          localId,
          url,
          filename: file.name,
          mimeType: file.type,
          checksum,
          type: mediaType,
          isCover: false,
          width: 0,
          height: 0,
          fileSize: file.size,
          duration: 0,
        }

        // Set first item as cover if list is empty
        setItems((prev) => {
          const updated = [...prev, { ...newItem, isCover: prev.length === 0 }]
          return updated
        })

        // Read image dimensions
        if (!isVideo) {
          const img = new Image()
          img.src = fileURL(url)
          img.onload = () => {
            setItems((prev) => prev.map((i) => i.localId === localId ? { ...i, width: img.naturalWidth, height: img.naturalHeight } : i))
          }
        }

        // Validate video duration
        if (isVideo) {
          const video = document.createElement('video')
          video.preload = 'metadata'
          video.src = fileURL(url)
          video.onloadedmetadata = () => {
            if (video.duration > GALLERY_VIDEO_MAX_DURATION) {
              setUploadError(t('galleryVideoDurationExceeded', { filename: file.name, duration: GALLERY_VIDEO_MAX_DURATION }))
              setItems((prev) => prev.filter((i) => i.localId !== localId))
            } else {
              setItems((prev) => prev.map((i) => i.localId === localId ? { ...i, duration: video.duration } : i))
            }
          }
        }
      } catch {
        setUploadError(t('galleryFileUploadFailed', { filename: file.name }))
      }
    }

    setUploading(false)
  }, [t])

  const handleRemoveItem = useCallback((localId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.localId !== localId)
      // If removed item was cover, set first item as cover
      if (prev.find((i) => i.localId === localId)?.isCover && next.length > 0) {
        next[0].isCover = true
      }
      return next
    })
  }, [])

  const handleSetCover = useCallback((localId: string) => {
    setItems((prev) => prev.map((i) => ({ ...i, isCover: i.localId === localId })))
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.localId === active.id)
        const newIndex = prev.findIndex((i) => i.localId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim() || items.length === 0) return

    const mediaItems: CreateAttachmentArgs[] = items.map((item, i) => ({
      url: item.url,
      filename: item.filename,
      mime_type: item.mimeType,
      checksum: item.checksum,
      type: item.type,
      sort_order: i,
      is_cover: item.isCover,
      width: item.width,
      height: item.height,
      file_size: item.fileSize,
      duration: item.duration,
    }))

    const data: CreateContentArgs = {
      title: title.trim(),
      summary: summary.trim(),
      type: 'gallery',
      status,
      category,
      tags,
      attachments: mediaItems,
    }

    const contentId = await save(data)
    if (contentId) onSaved(contentId, status)
  }

  if (loading) {
    return <div className="app-text-tertiary text-center py-20">{t('loading')}</div>
  }

  const uploadedItems = items.filter((i) => i.url)

  return (
    <form onSubmit={(e) => e.preventDefault()} className="app-surface-elevated border app-border rounded-xl p-6 space-y-5" data-testid="gallery-editor-form">
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
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('galleryDescription')}</label>
        <Textarea placeholder={t('galleryDescriptionPlaceholder')} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
      </div>

      {/* Gallery Items */}
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">
          {t('galleryItemsHint')} * <span className="app-text-tertiary font-normal text-xs">{t('galleryItemsVideoTip')}</span>
        </label>
        {uploadError && (
          <div className="text-xs mb-2 text-red-600 dark:text-red-400">{uploadError}</div>
        )}
        {uploadedItems.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={uploadedItems.map((i) => i.localId)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {uploadedItems.map((item) => (
                  <SortableGalleryItem
                    key={item.localId}
                    item={item}
                    onRemove={handleRemoveItem}
                    onSetCover={handleSetCover}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        <div
          className="app-surface-muted border-2 border-dashed app-border rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (e.dataTransfer.files.length > 0) handleFilesSelected(e.dataTransfer.files)
          }}
        >
          {uploading ? (
            <>
              <Loader2 size={24} className="app-text-tertiary animate-spin" />
              <span className="app-text-tertiary text-sm">{t('uploading')}</span>
            </>
          ) : (
            <>
              <Upload size={24} className="app-text-tertiary" />
              <span className="app-text-tertiary text-sm">{t('galleryUploadHint')}</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFilesSelected(e.target.files)
              e.target.value = ''
            }}
            className="hidden"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('tags')}</label>
        <div className="flex items-center gap-2 mb-2">
          <Input
            placeholder={t('tagsPlaceholder')}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={handleAddTag}><Plus size={14} />{t('addTag')}</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="app-chip px-2 py-1 rounded-full text-xs cursor-pointer" onClick={() => setTags(tags.filter((t) => t !== tag))}>
                {tag} ×
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <EditorActions
        saving={saving}
        isNew={isNew}
        contentStatus={contentStatus}
        disabled={!title.trim() || items.length === 0 || uploading}
        onSave={handleSubmit}
        onCancel={onCancel}
      />
    </form>
  )
}

export default GalleryEditorForm
