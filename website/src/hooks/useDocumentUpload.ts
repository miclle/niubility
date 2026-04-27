import { useState, useCallback, useRef } from 'react'
import { uploadFile } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'
import { newDocumentItem } from 'src/lib/document'
import type { DocumentItem } from 'src/lib/document'

let documentItemCounter = 0

// useDocumentUpload manages document attachment upload state and handlers.
export function useDocumentUpload() {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const docInputRef = useRef<HTMLInputElement>(null)

  // handleDocumentUpload filters non-media files and uploads them with progress tracking.
  const handleDocumentUpload = useCallback((files: File[]) => {
    const docFiles = files.filter((f) => !f.type.startsWith('video/') && !f.type.startsWith('image/'))
    if (docFiles.length === 0) return

    for (const file of docFiles) {
      const item = newDocumentItem({ filename: file.name, mimeType: file.type, fileSize: file.size, uploading: true })
      const localId = item.localId
      setDocuments((prev) => [...prev, item])

      Promise.all([
        uploadFile(file, (percent) => {
          setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, progress: percent } : d))
        }),
        computeFileChecksum(file),
      ]).then(([key, checksum]) => {
        setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, url: key, checksum, uploading: false, progress: 100 } : d))
      }).catch(() => {
        setDocuments((prev) => prev.filter((d) => d.localId !== localId))
      })
    }
  }, [])

  // handleDocumentChange updates a single field on a document item.
  const handleDocumentChange = useCallback((localId: string, field: keyof DocumentItem, value: string | number) => {
    setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, [field]: value } : d))
  }, [])

  // handleRemoveDocument removes a document item by localId.
  const handleRemoveDocument = useCallback((localId: string) => {
    setDocuments((prev) => prev.filter((d) => d.localId !== localId))
  }, [])

  // loadDocuments populates documents from existing content attachments (for editing).
  const loadDocuments = useCallback((attachments: Array<{id?: string; title?: string; filename?: string; url: string; mime_type?: string; checksum?: string; file_size: number; type: string}>) => {
    setDocuments(attachments.filter((m) => m.type === 'document').map((m) => ({
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
  }, [])

  return {
    documents,
    setDocuments,
    docInputRef,
    handleDocumentUpload,
    handleDocumentChange,
    handleRemoveDocument,
    loadDocuments,
  }
}
