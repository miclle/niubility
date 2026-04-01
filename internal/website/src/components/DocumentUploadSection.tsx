import { FileText, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatFileSize } from 'src/lib/utils'
import type { DocumentItem } from 'src/lib/document'
import type { RefObject } from 'react'

interface DocumentUploadSectionProps {
  documents: DocumentItem[]
  docInputRef: RefObject<HTMLInputElement | null>
  onUpload: (files: File[]) => void
  onChange: (localId: string, field: keyof DocumentItem, value: string | number) => void
  onRemove: (localId: string) => void
}

// DocumentUploadSection renders a drag-drop zone and list for document attachments.
function DocumentUploadSection({ documents, docInputRef, onUpload, onChange, onRemove }: DocumentUploadSectionProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>资料附件</label>
      <div
        className="rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6"
        style={{ border: '2px dashed #d4d4d4', background: '#fafafa' }}
        onClick={() => docInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onUpload(Array.from(e.dataTransfer.files)) }}
      >
        <FileText size={20} style={{ color: '#909090' }} />
        <span className="text-sm" style={{ color: '#909090' }}>拖拽文件到此处或点击选择（PDF, PPT, DOC, XLS, TXT等）</span>
      </div>
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md"
        multiple
        onChange={(e) => { if (e.target.files) onUpload(Array.from(e.target.files)); e.target.value = '' }}
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
                  onChange={(e) => onChange(doc.localId, 'title', e.target.value)}
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
                onClick={() => onRemove(doc.localId)}
                className="p-1.5 rounded hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} style={{ color: '#cc0000' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DocumentUploadSection
