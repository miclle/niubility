import { Link } from 'react-router-dom'
import { Badge } from '@radix-ui/themes'
import { PlayCircle } from 'lucide-react'
import dayjs from 'dayjs'

import type { Content } from 'src/types/content'

// ContentCard displays a content item as a card in the grid.
function ContentCard({ content }: { content: Content }) {
  return (
    <Link
      to={`/contents/${content.id}`}
      className="group block rounded-lg border border-gray-200 bg-white overflow-hidden no-underline text-inherit hover:shadow-md transition-shadow"
    >
      {/* Cover image */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {content.cover_url ? (
          <img src={content.cover_url} alt={content.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">暂无封面</div>
        )}
        {content.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <PlayCircle size={48} className="text-white/90" />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-gray-900 line-clamp-2 mb-2">{content.title}</h3>
        {content.summary && <p className="text-sm text-gray-500 line-clamp-2 mb-3">{content.summary}</p>}

        {/* Tags */}
        {content.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {content.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="soft" size="1">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{content.author?.name || '未知作者'}</span>
          <span>{dayjs(content.created_at).format('YYYY-MM-DD')}</span>
        </div>
      </div>
    </Link>
  )
}

export default ContentCard
