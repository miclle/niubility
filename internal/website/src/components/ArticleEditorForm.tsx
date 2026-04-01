import { useState, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

import { useContentEditor } from 'src/hooks/useContentEditor'
import { useDocumentUpload } from 'src/hooks/useDocumentUpload'
import { useAppContext } from 'src/context/app'
import ImageUpload from 'src/components/ImageUpload'
import RichTextEditor from 'src/components/RichTextEditor'
import SpeakerSelector from 'src/components/SpeakerSelector'
import TagInput from 'src/components/TagInput'
import DocumentUploadSection from 'src/components/DocumentUploadSection'
import EditorActions from 'src/components/EditorActions'
import type { ContentStatus, CreateContentArgs, CreateAttachmentArgs } from 'src/types/content'
import type { Content } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

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
  const { currentUser, categories } = useAppContext()
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin'

  const [body, setBody] = useState('')
  const [coverUrl, setCoverUrl] = useState('')

  // Speaker state (simplified)
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerBio, setSpeakerBio] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)

  const { documents, docInputRef, handleDocumentUpload, handleDocumentChange, handleRemoveDocument, loadDocuments } = useDocumentUpload()

  // Load type-specific fields from existing content
  const handleLoad = useCallback((c: Content) => {
    setBody(c.body || '')
    setCoverUrl(c.cover_url || '')

    // Load document attachments
    if (c.attachments && c.attachments.length > 0) {
      loadDocuments(c.attachments)
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

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

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

    const contentId = await save(data)
    if (contentId) onSaved(contentId, status)
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
      <DocumentUploadSection documents={documents} docInputRef={docInputRef} onUpload={handleDocumentUpload} onChange={handleDocumentChange} onRemove={handleRemoveDocument} />

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
      <EditorActions
        saving={saving}
        isNew={isNew}
        contentStatus={contentStatus}
        disabled={!title.trim()}
        onSave={handleSubmit}
        onCancel={onCancel}
      />
    </form>
  )
}

export default ArticleEditorForm
