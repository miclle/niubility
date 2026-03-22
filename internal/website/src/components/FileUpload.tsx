import { useState, useRef, useCallback } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'

import { uploadFile, fileURL } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'

// FileUploadMeta contains file metadata captured during upload.
export interface FileUploadMeta {
  filename: string
  mimeType: string
  fileSize: number
  checksum: string
}

// FileUploadProps defines the configurable behavior of the FileUpload component.
export interface FileUploadProps {
  // MIME types to accept (e.g., "image/*", "video/*").
  accept: string
  // Current file URL value.
  value: string
  // Callback when file URL changes.
  onChange: (url: string) => void
  // Optional callback with file metadata after upload completes.
  onFileUploaded?: (url: string, meta: FileUploadMeta) => void
  // Optional preview renderer. If not provided, defaults to a link.
  renderPreview?: (url: string) => React.ReactNode
  // Placeholder text.
  placeholder?: string
}

// FileUpload is a generic file upload component with drag-and-drop and progress support.
function FileUpload({ accept, value, onChange, onFileUploaded, renderPreview, placeholder = '拖拽文件到此处或点击选择' }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setProgress(0)
    try {
      const [url, checksum] = await Promise.all([
        uploadFile(file, setProgress),
        computeFileChecksum(file),
      ])
      onChange(url)
      onFileUploaded?.(url, { filename: file.name, mimeType: file.type, fileSize: file.size, checksum })
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }, [onChange, onFileUploaded])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const handleRemove = () => {
    onChange('')
  }

  if (value) {
    return (
      <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
        <div className="p-3">
          {renderPreview ? renderPreview(fileURL(value)) : (
            <a href={fileURL(value)} target="_blank" rel="noreferrer" className="text-sm break-all" style={{ color: '#2563eb' }}>{value}</a>
          )}
        </div>
        <button
          type="button"
          className="absolute top-2 right-2 p-1 rounded-full transition-colors"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={handleRemove}
        >
          <X size={14} style={{ color: '#ffffff' }} />
        </button>
      </div>
    )
  }

  return (
    <div
      className="relative rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6"
      style={{
        border: `2px dashed ${dragOver ? '#0f0f0f' : '#d4d4d4'}`,
        background: dragOver ? '#f8f8f8' : '#fafafa',
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {uploading ? (
        <>
          <Loader2 size={24} className="animate-spin" style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>上传中 {progress}%</span>
          <div className="w-full max-w-xs h-1.5 rounded-full overflow-hidden" style={{ background: '#e5e5e5' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: '#0f0f0f' }} />
          </div>
        </>
      ) : (
        <>
          <Upload size={24} style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>{placeholder}</span>
        </>
      )}
      <input ref={inputRef} type="file" accept={accept} onChange={handleFileChange} className="hidden" />
    </div>
  )
}

export default FileUpload
