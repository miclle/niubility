// DocumentItem tracks upload progress and metadata for files being uploaded.
// Uses localId for React keys before the server assigns a permanent ID.
export interface DocumentItem {
  localId: string
  title: string
  filename: string
  url: string
  mimeType: string
  checksum: string
  fileSize: number
  uploading: boolean
  progress: number
}

let documentItemCounter = 0

// newDocumentItem creates a new DocumentItem with a unique local ID.
export function newDocumentItem(overrides?: Partial<DocumentItem>): DocumentItem {
  return {
    localId: `doc_${++documentItemCounter}`,
    title: '',
    filename: '',
    url: '',
    mimeType: '',
    checksum: '',
    fileSize: 0,
    uploading: false,
    progress: 0,
    ...overrides,
  }
}
