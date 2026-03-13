import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Avatar } from '@radix-ui/themes'
import { ArrowLeft } from 'lucide-react'
import dayjs from 'dayjs'

import { getContent } from 'src/api/content'
import type { Content } from 'src/types/content'

// ContentDetail displays a single content item with full details.
function ContentDetail() {
  const { id } = useParams<{ id: string }>()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getContent(id)
      .then((res) => setContent(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center text-zinc-400">加载中...</div>
  }

  if (error || !content) {
    return <div className="max-w-4xl mx-auto px-6 py-20 text-center text-zinc-400">内容不存在</div>
  }

  const categoryPath = content.category === 'culture' ? '/culture' : '/learning'

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link to={categoryPath} className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-800 no-underline mb-6 transition-colors">
        <ArrowLeft size={16} />
        返回列表
      </Link>

      {/* Title */}
      <h1 className="text-3xl font-bold text-zinc-800 mb-4">{content.title}</h1>

      {/* Meta */}
      <div className="flex items-center gap-4 mb-6 text-sm text-zinc-500">
        {content.author && (
          <div className="flex items-center gap-2">
            <Avatar size="1" radius="full" src={content.author.avatar} fallback={content.author.name?.charAt(0) || '?'} />
            <span>{content.author.name}</span>
          </div>
        )}
        <span>{dayjs(content.created_at).format('YYYY-MM-DD HH:mm')}</span>
        <span className="glass-badge">{content.type === 'video' ? '视频' : '图文'}</span>
      </div>

      {/* Tags */}
      {content.tags?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {content.tags.map((tag) => (
            <span key={tag} className="glass-badge">{tag}</span>
          ))}
        </div>
      )}

      {/* Cover / Video */}
      {content.type === 'video' && content.video_url ? (
        <div className="mb-8 rounded-lg overflow-hidden bg-black shadow-[0_0_30px_rgba(124,58,237,0.1)]">
          <video src={content.video_url} controls className="w-full" poster={content.cover_url || undefined} />
        </div>
      ) : content.cover_url ? (
        <div className="mb-8 rounded-lg overflow-hidden">
          <img src={content.cover_url} alt={content.title} className="w-full" />
        </div>
      ) : null}

      {/* Speaker info */}
      {content.speaker && (
        <div className="glass-surface border-l-2 border-l-violet-500 p-4 mb-8">
          <div className="text-sm font-medium text-zinc-700 mb-1">主讲人：{content.speaker}</div>
          {content.speaker_bio && <div className="text-sm text-zinc-500">{content.speaker_bio}</div>}
        </div>
      )}

      {/* Body */}
      {content.body && (
        <div className="prose-dark" dangerouslySetInnerHTML={{ __html: content.body }} />
      )}
    </div>
  )
}

export default ContentDetail
