import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

import type { Content } from 'src/types/content'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

// ContentCard displays a content item as a YouTube-style video card.
function ContentCard({ content }: { content: Content }) {
  return (
    <Link
      to={`/contents/${content.id}`}
      className="group block no-underline"
      style={{ color: 'inherit' }}
    >
      {/* Thumbnail - YouTube style */}
      <div className="relative" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div className="relative aspect-video bg-zinc-200">
          <img
            src={content.cover_url || '/default-cover.svg'}
            alt={content.title}
            className="w-full h-full object-cover"
            style={{ transition: 'transform 0.3s' }}
          />
          {/* Video play icon overlay */}
          {content.type === 'video' && (
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.3)' }}
            >
              <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: '50%', padding: 12 }}>
                <Play size={32} fill="white" style={{ color: 'white' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card info - YouTube style: horizontal layout with avatar */}
      <div className="flex gap-3 mt-3">
        {/* Author avatar */}
        <div className="flex-shrink-0">
          <div
            className="w-9 h-9 rounded-full bg-zinc-300 flex items-center justify-center text-sm font-medium"
            style={{ color: '#0f0f0f' }}
          >
            {content.author?.name?.charAt(0) || '匿'}
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          {/* Title - max 2 lines */}
          <h3
            className="text-sm font-medium line-clamp-2 mb-1"
            style={{ color: '#0f0f0f' }}
          >
            {content.title}
          </h3>

          {/* Author name */}
          <div className="text-xs mb-0.5" style={{ color: '#606060' }}>
            {content.author?.name || '未知作者'}
          </div>

          {/* Meta info */}
          <div className="text-xs" style={{ color: '#606060' }}>
            {dayjs(content.created_at).fromNow()}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default ContentCard
