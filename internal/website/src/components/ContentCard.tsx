import { Link } from 'react-router-dom'
import { PlayCircle } from 'lucide-react'
import dayjs from 'dayjs'

import type { Content } from 'src/types/content'

// ContentCard displays a content item as a card in the grid.
function ContentCard({ content }: { content: Content }) {
  return (
    <Link
      to={`/contents/${content.id}`}
      className="group block glass-card overflow-hidden no-underline text-inherit"
    >
      {/* Cover image */}
      <div className="relative aspect-video bg-zinc-100 overflow-hidden">
        {content.cover_url ? (
          <>
            <img src={content.cover_url} alt={content.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">暂无封面</div>
        )}
        {content.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <PlayCircle size={48} className="text-white/90" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-zinc-800 line-clamp-2 mb-2 group-hover:gradient-text transition-colors">{content.title}</h3>
        {content.summary && <p className="text-sm text-zinc-500 line-clamp-2 mb-3">{content.summary}</p>}

        {/* Tags */}
        {content.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {content.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="glass-badge">{tag}</span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{content.author?.name || '未知作者'}</span>
          <span>{dayjs(content.created_at).format('YYYY-MM-DD')}</span>
        </div>
      </div>
    </Link>
  )
}

export default ContentCard
