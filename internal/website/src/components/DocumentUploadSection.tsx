import { FileText, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatFileSize } from 'src/lib/utils'
import { useTranslation } from 'react-i18next'
import type { DocumentItem } from 'src/lib/document'
import type { RefObject } from 'react'

interface DocumentUploadSectionProps {
  documents: DocumentItem[]
  docInputRef: RefObject<HTMLInputElement>
  onUpload: (files: File[]) => void
  onChange: (localId: string, field: keyof DocumentItem, value: string | number) => void
  onRemove: (localId: string) => void
}

// DocumentUploadSection renders a drag-drop zone and list for document attachments.
function DocumentUploadSection({ documents, docInputRef, onUpload, onChange, onRemove }: DocumentUploadSectionProps) {
  const { t } = useTranslation('editor')
  return (
    <div>
      <label className="app-text-secondary block text-sm font-medium mb-1.5">{t('documentAttachments')}</label>
      <div
        className="app-surface-muted rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed app-border"
        onClick={() => docInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); onUpload(Array.from(e.dataTransfer.files)) }}
      >
        <FileText size={20} className="app-text-tertiary" />
        <span className="app-text-tertiary text-sm">{t('documentHint')}</span>
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
            <div key={doc.localId} className="app-surface-elevated border app-border flex items-center gap-3 p-3 rounded-lg">
              <FileText size={20} className="app-text-tertiary" />
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t('documentTitleOptional')}
                  value={doc.title}
                  onChange={(e) => onChange(doc.localId, 'title', e.target.value)}
                  className="mb-1"
                />
                <div className="app-text-tertiary text-xs truncate">
                  {doc.filename} {doc.fileSize > 0 && `(${formatFileSize(doc.fileSize)})`}
                </div>
                {doc.uploading && (
                  <div className="mt-2 w-full h-1 rounded-full overflow-hidden bg-[var(--surface-border)]">
                    <div className="h-full rounded-full transition-all bg-foreground" style={{ width: `${doc.progress}%` }} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(doc.localId)}
                className="p-1.5 rounded transition-colors hover:bg-red-500/10"
              >
                <Trash2 size={14} className="text-red-600 dark:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DocumentUploadSection
