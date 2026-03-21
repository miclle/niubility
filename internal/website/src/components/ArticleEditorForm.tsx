import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Save, X, Plus } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import { searchUsers } from 'src/api/user'
import { useAppContext } from 'src/context/app'
import ImageUpload from 'src/components/ImageUpload'
import RichTextEditor from 'src/components/RichTextEditor'
import type { ContentStatus, CreateContentArgs } from 'src/types/content'
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
  const isNew = !id
  const { categories } = useAppContext()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [category, setCategory] = useState<string>(categories[0]?.slug || 'learning')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [contentStatus, setContentStatus] = useState<ContentStatus>('draft')

  // Speaker state
  const [speakerId, setSpeakerId] = useState(defaultSpeaker?.id || '')
  const [selectedSpeaker, setSelectedSpeaker] = useState<SearchUserItem | null>(defaultSpeaker || null)
  const [speakerInput, setSpeakerInput] = useState('')
  const [speakerBio, setSpeakerBio] = useState('')
  const [speakerResults, setSpeakerResults] = useState<SearchUserItem[]>([])
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false)
  const speakerDropdownRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (speakerDropdownRef.current && !speakerDropdownRef.current.contains(e.target as Node)) {
        setShowSpeakerDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

        if (c.speaker_id && c.speaker) {
          setSpeakerId(c.speaker_id)
          setSelectedSpeaker({ id: c.speaker.id, name: c.speaker.name, avatar: c.speaker.avatar })
        } else if (c.speaker_name) {
          setSpeakerInput(c.speaker_name)
        }
        setSpeakerBio(c.speaker_bio || '')
      })
      .catch(() => onLoadError())
      .finally(() => setLoading(false))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpeakerInputChange = (value: string) => {
    setSpeakerInput(value)
    if (speakerId) { setSpeakerId(''); setSelectedSpeaker(null) }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value.trim()) { setSpeakerResults([]); setShowSpeakerDropdown(false); return }
    searchTimerRef.current = setTimeout(() => {
      searchUsers(value.trim()).then((res) => {
        setSpeakerResults(res.data.users)
        setShowSpeakerDropdown(res.data.users.length > 0)
      })
    }, 300)
  }

  const handleSelectSpeaker = (user: SearchUserItem) => {
    setSpeakerId(user.id); setSelectedSpeaker(user); setSpeakerInput(''); setSpeakerResults([]); setShowSpeakerDropdown(false)
  }

  const handleClearSpeaker = () => { setSpeakerId(''); setSelectedSpeaker(null); setSpeakerInput('') }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const handleSubmit = async (status: ContentStatus) => {
    if (!title.trim()) return

    setSaving(true)
    try {
      const data: CreateContentArgs = {
        title: title.trim(),
        body,
        cover_url: coverUrl.trim(),
        type: 'article',
        status,
        category,
        tags,
        speaker_id: speakerId || '',
        speaker_name: speakerId ? '' : speakerInput.trim(),
        speaker_bio: speakerBio.trim(),
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
      {/* Title - Medium style large input */}
      <div>
        <input
          type="text"
          placeholder="输入文章标题..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full text-3xl font-bold border-0 outline-none placeholder:text-zinc-300 bg-transparent"
          style={{ color: '#0f0f0f', lineHeight: 1.3 }}
        />
      </div>

      {/* Cover Image */}
      <div>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} category="covers" />
      </div>

      {/* Body - Rich Text Editor */}
      <div>
        <RichTextEditor value={body} onChange={setBody} />
      </div>

      {/* Meta fields in a compact section */}
      <div className="bg-white rounded-xl p-5 space-y-4" style={{ border: '1px solid #e5e5e5' }}>
        <h3 className="text-sm font-medium" style={{ color: '#0f0f0f' }}>文章设置</h3>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
          <Select value={category} onValueChange={(val) => val && setCategory(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择分类">
                {(value: string) => {
                  const cat = categories.find((c) => c.slug === value)
                  return cat?.name || value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.slug} value={cat.slug}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标签</label>
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="输入标签后按回车或点击添加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleAddTag}><Plus size={14} />添加</Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="px-2 py-1 rounded-full text-xs cursor-pointer" style={{ background: '#f2f2f2', color: '#606060' }} onClick={() => setTags(tags.filter((t) => t !== tag))}>
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Speaker */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>作者/主讲人</label>
            {selectedSpeaker ? (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: '#f8f8f8', border: '1px solid #e5e5e5' }}>
                <Avatar size="sm">
                  <AvatarImage src={selectedSpeaker.avatar} alt={selectedSpeaker.name} />
                  <AvatarFallback>{selectedSpeaker.name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1" style={{ color: '#0f0f0f' }}>{selectedSpeaker.name}</span>
                <button type="button" className="p-1 rounded-full hover:bg-gray-200 transition-colors" onClick={handleClearSpeaker}>
                  <X size={14} style={{ color: '#909090' }} />
                </button>
              </div>
            ) : (
              <div className="relative" ref={speakerDropdownRef}>
                <Input placeholder="输入作者姓名，可自动匹配员工" value={speakerInput} onChange={(e) => handleSpeakerInputChange(e.target.value)} onFocus={() => { if (speakerResults.length > 0) setShowSpeakerDropdown(true) }} />
                {showSpeakerDropdown && speakerResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-lg shadow-lg overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e5e5e5', maxHeight: 240, overflowY: 'auto' }}>
                    {speakerResults.map((user) => (
                      <button key={user.id} type="button" className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-gray-50 transition-colors" onClick={() => handleSelectSpeaker(user)}>
                        <Avatar size="sm">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm" style={{ color: '#0f0f0f' }}>{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>作者简介</label>
            <Input placeholder="作者简介" value={speakerBio} onChange={(e) => setSpeakerBio(e.target.value)} />
          </div>
        </div>
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
