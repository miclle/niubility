import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Save, X, FileText, Trash2 } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import { uploadFile } from 'src/api/upload'
import { computeFileChecksum } from 'src/lib/file-checksum'
import { formatFileSize } from 'src/lib/utils'
import { newDocumentItem } from 'src/lib/document'
import { useAppContext } from 'src/context/app'
import ImageUpload from 'src/components/ImageUpload'
import RichTextEditor from 'src/components/RichTextEditor'
import SpeakerSelector from 'src/components/SpeakerSelector'
import TagInput from 'src/components/TagInput'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'
import type { DocumentItem } from 'src/lib/document'

let documentItemCounter = 0

// ArticleEditorFormProps defines the configurable behavior of the article editor form.
export interface ArticleEditorFormProps {
  id?: string
  defaultSpeaker?: SearchUserItem
  onSaved: (contentId: string, status: ContentStatus) => void
  onCancel: () => void
  onLoadError: () => void
}

// ArticleEditorForm is the editor form for creating/editing long-form article content.
function ArticleEditorForm({ id, defaultSpeaker, onSaved, onCancel, onLoadError }: ArticleEditorFormProps) {
  const isNew = !id
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [category, setCategory] = useState<string>(categories[0]?.slug || '')
  const [tags, setTags] = useState<string[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [contentStatus, setContentStatus] = useState<ContentStatus>('draft')

  // Speaker state (simplified)
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerBio, setSpeakerBio] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Load existing content for editing
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => {
        const c = res.data
        setTitle(c.title)
        setBody(c.body || '')
        setCoverUrl(c.cover_url || '')
        setCategory(c.category)
        setTags(c.tags || [])
        setContentStatus(c.status || 'published')

        // Load document attachments
        if (c.attachments && c.attachments.length > 0) {
          setDocuments(c.attachments.filter((m) => m.type === 'document').map((m) => ({
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
        }

        if (c.speaker_id && c.speaker) {
          setSpeakerId(c.speaker_id)
          setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
        }
        setSpeakerBio(c.speaker_bio || '')

        // Auto-resize title textarea after content loads
        requestAnimationFrame(() => {
          if (titleRef.current) {
            titleRef.current.style.height = 'auto'
            titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
          }
        })
      })
      .catch(() => onLoadError())
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpeakerChange = (speaker: SearchUserItem | null) => {
    setSpeakerId(speaker?.id || '')
    setSelectedSpeaker(speaker)
  }

  // handleDocumentUpload uploads one or more document files.
  const docInputRef = useRef<HTMLInputElement>(null)
  const handleDocumentUpload = useCallback((files: File[]) => {
    const docFiles = files.filter((f) => !f.type.startsWith('image/'))
    if (docFiles.length === 0) return

    for (const file of docFiles) {
      const item = newDocumentItem({ filename: file.name, mimeType: file.type, fileSize: file.size, uploading: true })
      const localId = item.localId
      setDocuments((prev) => [...prev, item])

      // Upload file and compute checksum in parallel
      Promise.all([
        uploadFile(file, (percent) => {
          setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, progress: percent } : d))
        }),
        computeFileChecksum(file),
      ]).then(([key, checksum]) => {
        setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, url: key, checksum, uploading: false, progress: 100 } : d))
      }).catch(() => {
        // Remove failed item
        setDocuments((prev) => prev.filter((d) => d.localId !== localId))
      })
    }
  }, [])

  const handleDocumentChange = useCallback((localId: string, field: keyof DocumentItem, value: string | number) => {
    setDocuments((prev) => prev.map((d) => d.localId === localId ? { ...d, [field]: value } : d))
  }, [])

  const handleRemoveDocument = useCallback((localId: string) => {
    setDocuments((prev) => prev.filter((d) => d.localId !== localId))
  }, [])

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

    setSaving(true)
    try {
      // Collect images as attachments: cover image + body inline images
      const mediaItems: CreateAttachmentArgs[] = []
      let sortOrder = 0

      if (coverUrl.trim()) {
        mediaItems.push({ url: coverUrl.trim(), type: 'image', sort_order: sortOrder++, is_cover: true })
      }

      // Extract inline image URLs from body HTML
      const imgRegex = /<img[^>]+src="([^"]+)"/g
      let match
      while ((match = imgRegex.exec(body)) !== null) {
        mediaItems.push({ url: match[1], type: 'image', sort_order: sortOrder++ })
      }

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
        body,
        cover_url: coverUrl.trim(),
        type: 'article',
        status,
        category,
        tags,
        speaker_id: speakerId || '',
        speaker_name: speakerId ? '' : (selectedSpeaker?.name || ''),
        speaker_bio: speakerBio.trim(),
        attachments: allAttachments,
      }

      if (isNew) {
        const res = await createContent(data)
        onSaved(res.data.id, status)
      } else {
        await updateContent(id!, data)
        onSaved(id!, status)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      {/* Title - Medium style, auto-resize textarea */}
      <div>
        <textarea
          ref={titleRef}
          placeholder="输入文章标题..."
          value={title}
          onChange={(e) => { setTitle(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
          required
          rows={1}
          className="w-full text-3xl font-bold border-0 outline-none placeholder:text-zinc-300 bg-transparent resize-none overflow-hidden"
          style={{ color: '#0f0f0f', lineHeight: 1.3 }}
        />
      </div>

      {/* Cover Image */}
      <div>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} placeholder="拖拽或点击上传封面图片" />
      </div>

      {/* Body - Rich Text Editor */}
      <div>
        <RichTextEditor value={body} onChange={setBody} />
      </div>

      {/* Document Attachments */}
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>资料附件</label>
        <div
          className="rounded-lg cursor-pointer transition-colors flex flex-col items-center justify-center gap-2 p-6"
          style={{ border: '2px dashed #d4d4d4', background: '#fafafa' }}
          onClick={() => docInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleDocumentUpload(Array.from(e.dataTransfer.files)) }}
        >
          <FileText size={20} style={{ color: '#909090' }} />
          <span className="text-sm" style={{ color: '#909090' }}>拖拽文件到此处或点击选择（PDF, PPT, DOC, XLS, TXT等）</span>
        </div>
        <input
          ref={docInputRef}
          type="file"
          accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md"
          multiple
          onChange={(e) => { if (e.target.files) handleDocumentUpload(Array.from(e.target.files)); e.target.value = '' }}
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
                    onChange={(e) => handleDocumentChange(doc.localId, 'title', e.target.value)}
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
                  onClick={() => handleRemoveDocument(doc.localId)}
                  className="p-1.5 rounded hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} style={{ color: '#cc0000' }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta fields in a compact section */}
      <div className="bg-white rounded-xl p-5 space-y-4" style={{ border: '1px solid #e5e5e5' }}>
        <h3 className="text-sm font-medium" style={{ color: '#0f0f0f' }}>文章设置</h3>

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

        {/* Tags */}
        <TagInput tags={tags} onChange={setTags} label="标签" />

        {/* Speaker (admin only) */}
        {isAdmin && (
          <div className="space-y-3">
            <SpeakerSelector
              defaultSpeaker={selectedSpeaker || undefined}
              onChange={handleSpeakerChange}
              label="作者/主讲人"
            />
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>作者简介</label>
              <Input placeholder="作者简介" value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
        {(isNew || contentStatus === 'draft') ? (
          <>
            <Button type="button" variant="outline" disabled={saving || !title.trim()} onClick={() => handleSubmit('draft')}>
              <Save size={16} />
              {saving ? '保存中...' : '保存草稿'}
            </Button>
            <Button type="button" disabled={saving || !title.trim()} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              {saving ? '发布中...' : '发布'}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" disabled={saving || !title.trim()} onClick={() => handleSubmit('published')} style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}>
              <Save size={16} />
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => handleSubmit('draft')}>
              转为草稿
            </Button>
          </>
        )}
        <Button type="button" variant="outline" onClick={onCancel}><X size={16} />取消</Button>
      </div>
    </form>
  )
}

export default ArticleEditorForm
