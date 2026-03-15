import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, X, Plus } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { getContent, createContent, updateContent } from 'src/api/content'
import type { ContentType, ContentCategory, CreateContentArgs } from 'src/types/content'

// ContentEditor provides a form for creating or editing content.
// Accessible to all logged-in users.
function ContentEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentUser } = useAppContext()
  const isNew = !id

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser) {
      window.location.href = '/sso?redirect=' + encodeURIComponent(location.pathname)
    }
  }, [currentUser, location.pathname])

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [type, setType] = useState<ContentType>('article')
  const [category, setCategory] = useState<ContentCategory>('learning')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [speakerBio, setSpeakerBio] = useState('')
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
        setSummary(c.summary || '')
        setBody(c.body || '')
        setCoverUrl(c.cover_url || '')
        setVideoUrl(c.video_url || '')
        setType(c.type)
        setCategory(c.category)
        setTags(c.tags || [])
        setSpeaker(c.speaker || '')
        setSpeakerBio(c.speaker_bio || '')
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    try {
      const data: CreateContentArgs = {
        title: title.trim(),
        summary: summary.trim(),
        body,
        cover_url: coverUrl.trim(),
        video_url: videoUrl.trim(),
        type,
        category,
        tags,
        speaker: speaker.trim(),
        speaker_bio: speakerBio.trim(),
      }

      if (isNew) {
        const res = await createContent(data)
        navigate(`/contents/${res.data.id}`)
      } else {
        await updateContent(id!, data)
        navigate(`/contents/${id}`)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  if (!currentUser) {
    return null
  }

  if (loading) {
    return <div className="text-center py-20" style={{ color: '#909090' }}>加载中...</div>
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>{isNew ? '创建内容' : '编辑内容'}</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ border: '1px solid #e5e5e5' }}
      >
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标题 *</label>
          <Input
            placeholder="请输入标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Type & Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>类型 *</label>
            <Select value={type} onValueChange={(val) => setType(val as ContentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="article">图文</SelectItem>
                <SelectItem value="video">视频</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
            <Select value={category} onValueChange={(val) => setCategory(val as ContentCategory)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learning">学习交流</SelectItem>
                <SelectItem value="culture">企业文化</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>摘要</label>
          <Textarea
            placeholder="请输入内容摘要"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>正文</label>
          <Textarea
            placeholder="请输入正文内容（支持 HTML）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
        </div>

        {/* Cover URL */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>封面图 URL</label>
          <Input
            placeholder="https://example.com/cover.jpg"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>

        {/* Video URL */}
        {type === 'video' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>视频 URL</label>
            <Input
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标签</label>
          <div className="flex items-center gap-2 mb-2">
            <Input
              placeholder="输入标签后按回车或点击添加"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddTag}
            >
              <Plus size={14} />
              添加
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded-full text-xs cursor-pointer"
                  style={{ background: '#f2f2f2', color: '#606060' }}
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag} ×
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Speaker */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人</label>
            <Input
              placeholder="主讲人姓名"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人简介</label>
            <Input
              placeholder="主讲人简介"
              value={speakerBio}
              onChange={(e) => setSpeakerBio(e.target.value)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
          <Button
            type="submit"
            disabled={saving || !title.trim()}
            style={{
              background: '#0f0f0f',
              color: '#ffffff',
              borderRadius: '18px',
            }}
          >
            <Save size={16} />
            {saving ? '保存中...' : '发布'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(-1)}
          >
            <X size={16} />
            取消
          </Button>
        </div>
      </form>
    </div>
  )
}

export default ContentEditor
