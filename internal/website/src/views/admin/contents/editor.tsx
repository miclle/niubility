import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, TextField, TextArea, Select, Badge } from '@radix-ui/themes'
import { Save, X, Plus } from 'lucide-react'

import { getContent, createContent, updateContent } from 'src/api/content'
import type { ContentType, ContentCategory, CreateContentArgs } from 'src/types/content'

// ContentEditor provides a form for creating or editing content with YouTube-style design.
function ContentEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = !id

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
      .catch(() => navigate('/admin/contents'))
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
        await createContent(data)
      } else {
        await updateContent(id!, data)
      }
      navigate('/admin/contents')
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
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>{isNew ? '新建内容' : '编辑内容'}</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl p-6 space-y-5"
        style={{ border: '1px solid #e5e5e5' }}
      >
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标题 *</label>
          <TextField.Root
            size="2"
            placeholder="请输入标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* Type & Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>类型 *</label>
            <Select.Root size="2" value={type} onValueChange={(val) => setType(val as ContentType)}>
              <Select.Trigger className="w-full" style={{ borderRadius: 8 }} />
              <Select.Content style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 8 }}>
                <Select.Item value="article">图文</Select.Item>
                <Select.Item value="video">视频</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>分类 *</label>
            <Select.Root size="2" value={category} onValueChange={(val) => setCategory(val as ContentCategory)}>
              <Select.Trigger className="w-full" style={{ borderRadius: 8 }} />
              <Select.Content style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 8 }}>
                <Select.Item value="learning">学习交流</Select.Item>
                <Select.Item value="culture">企业文化</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {/* Summary */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>摘要</label>
          <TextArea
            size="2"
            placeholder="请输入内容摘要"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>正文</label>
          <TextArea
            size="2"
            placeholder="请输入正文内容（支持 HTML）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* Cover URL */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>封面图 URL</label>
          <TextField.Root
            size="2"
            placeholder="https://example.com/cover.jpg"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* Video URL */}
        {type === 'video' && (
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>视频 URL</label>
            <TextField.Root
              size="2"
              placeholder="https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>标签</label>
          <div className="flex items-center gap-2 mb-2">
            <TextField.Root
              size="2"
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
              style={{ borderRadius: 8 }}
            />
            <Button
              type="button"
              variant="soft"
              size="2"
              onClick={handleAddTag}
              style={{ borderRadius: '18px', background: '#f2f2f2', color: '#0f0f0f' }}
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
            <TextField.Root
              size="2"
              placeholder="主讲人姓名"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#606060' }}>主讲人简介</label>
            <TextField.Root
              size="2"
              placeholder="主讲人简介"
              value={speakerBio}
              onChange={(e) => setSpeakerBio(e.target.value)}
              style={{ borderRadius: 8 }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4" style={{ borderTop: '1px solid #e5e5e5' }}>
          <Button
            type="submit"
            size="2"
            disabled={saving || !title.trim()}
            style={{
              background: '#0f0f0f',
              color: '#ffffff',
              borderRadius: '18px',
            }}
          >
            <Save size={16} />
            {saving ? '保存中...' : '保存'}
          </Button>
          <Button
            type="button"
            variant="soft"
            color="gray"
            size="2"
            onClick={() => navigate('/admin/contents')}
            style={{ borderRadius: '18px', background: '#f2f2f2', color: '#606060' }}
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
