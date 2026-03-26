import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GripVertical, Trash2, Loader2 } from 'lucide-react'

import { fileURL } from 'src/api/upload'
import ImageUpload from 'src/components/ImageUpload'

// VideoItem is a local state item for the video playlist editor.
export interface VideoItem {
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

// SortableVideoItemProps defines the props for SortableVideoItem.
export interface SortableVideoItemProps {
  item: VideoItem
  index: number
  onChange: (localId: string, field: keyof VideoItem, value: string | number) => void
  onRemove: (localId: string) => void
}

// SortableVideoItem renders a single draggable video item in the playlist.
export default function SortableVideoItem({ item, index, onChange, onRemove }: SortableVideoItemProps) {
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
