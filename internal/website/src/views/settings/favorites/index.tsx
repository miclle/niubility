import { useRef, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { FileText, Play, Image, Heart, MessageSquare, Bookmark } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { listFavorites } from 'src/api/content'
import { contentDetailPath } from 'src/lib/content-url'
import { useIntersection } from 'src/hooks/use-intersection'

const limit = 20

// Favorites displays the current user's favorited content list with infinite scroll.
function Favorites() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { currentUser } = useAppContext()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['my-favorites'],
      queryFn: ({ pageParam }) => listFavorites({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  const typeIcon = (type: string) => {
    if (type === 'video') return <Play size={20} />
    if (type === 'gallery') return <Image size={20} />
    return <FileText size={20} />
  }

  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>{t('settings:myFavoritesTitle')}</h1>

      {contents.length === 0 && !loading ? (
        <div className="text-center py-16">
          <Bookmark size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
          <p className="text-sm" style={{ color: '#909090' }}>{tc('common:noContent')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {contents.map((content) => (
            <div
              key={content.id}
              className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-black/5 transition-colors"
            >
              {/* Type icon */}
              <div className="flex-shrink-0" style={{ color: '#909090' }}>
                {typeIcon(content.type)}
              </div>

              {/* Title and meta */}
              <div className="flex-1 min-w-0">
                <NavLink
                  to={contentDetailPath(content)}
                  className="text-sm font-medium no-underline hover:underline truncate block"
                  style={{ color: '#0f0f0f' }}
                >
                  {content.title}
                </NavLink>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs" style={{ color: '#909090' }}>
                    {content.author?.name || tc('common:unknownAuthor')}
                  </span>
                  <span className="text-xs" style={{ color: '#909090' }}>
                    {new Date(content.created_at).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                    <Heart size={12} /> {content.like_count}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: '#909090' }}>
                    <MessageSquare size={12} /> {content.comment_count}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? tc('common:loading') : !hasNextPage && contents.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default Favorites
