import { useRef, useCallback, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Heart, MessageSquare, ArrowDown, Sparkles } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { listFavorites } from 'src/api/content'
import { getStyledContentCardCover } from 'src/lib/content-assets'
import { contentDetailPath } from 'src/lib/content-url'
import { toPlainTextPreview } from 'src/lib/utils'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ContentType } from 'src/types/content'

const limit = 20

// Favorites displays the current user's favorited content list with infinite scroll.
function Favorites() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { currentUser, siteConfig } = useAppContext()
  const [activeType, setActiveType] = useState<ContentType>('video')

  const typeTabs: Array<{ key: ContentType; label: string }> = [
    { key: 'video', label: t('settings:videos') },
    { key: 'gallery', label: t('settings:galleries') },
    { key: 'article', label: t('settings:articles') },
  ]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['my-favorites'],
      queryFn: ({ pageParam }) => listFavorites({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    })

  const allContents = data?.pages.flatMap((p) => p.data.items) ?? []
  const contents = allContents.filter((content) => content.type === activeType)
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage
  const activeTypeLabel = typeTabs.find((tab) => tab.key === activeType)?.label || t('settings:myFavorites')

  return (
    <div className="min-h-full bg-white">
      <div className="px-6 pt-8 pb-0 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight" style={{ color: '#0f0f0f' }}>{t('settings:myFavoritesTitle')}</h1>

        <div className="mt-6 -mx-6 flex gap-10 overflow-x-auto border-b border-[#ececec] px-6 lg:-mx-12 lg:px-12">
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className="relative shrink-0 pb-2.5 text-[15px] font-semibold transition-colors"
              style={{ color: activeType === tab.key ? '#0f0f0f' : '#6f6f6f' }}
          >
              {tab.label}
              {activeType === tab.key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ background: '#0f0f0f' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {contents.length === 0 && !loading
        ? (
            <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center lg:px-12">
              <div
                className="flex h-40 w-40 items-center justify-center rounded-[2rem]"
                style={{ background: 'linear-gradient(180deg, #dff8ff 0%, #b5ecff 100%)' }}
              >
                <Sparkles size={72} strokeWidth={1.5} style={{ color: '#1296c9' }} />
              </div>
              <h2 className="mt-8 text-2xl font-semibold" style={{ color: '#0f0f0f' }}>
                {t('settings:myFavoritesTitle')}
              </h2>
              <p className="mt-3 max-w-md text-sm leading-6" style={{ color: '#707070' }}>
                {t('settings:noFavoritesForType')}
              </p>
            </div>
          )
        : (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] table-fixed">
                  <colgroup>
                    <col style={{ width: '60%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[#ececec]">
                      <th className="px-6 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>{activeTypeLabel}</th>
                      <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#0f0f0f' }}>
                        <span className="inline-flex items-center gap-1">
                          {t('settings:dateColumn')}
                          <ArrowDown size={14} />
                        </span>
                      </th>
                      <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('settings:likesColumn')}</th>
                      <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>{t('settings:commentsColumn')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contents.map((content) => (
                      <tr key={content.id} className="border-b border-[#ececec] align-top">
                        <td className="px-6 py-5">
                          <div className="flex items-start gap-5">
                            <div className="mt-0.5 h-24 w-[168px] shrink-0 overflow-hidden rounded-2xl bg-[#f5f5f5]">
                              <img
                                src={getStyledContentCardCover(content, siteConfig)}
                                alt={content.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            </div>

                            <div className="min-w-0 flex-1">
                              <NavLink
                                to={contentDetailPath(content)}
                                className="block truncate text-[15px] font-medium no-underline hover:underline"
                                style={{ color: '#0f0f0f' }}
                              >
                                {content.title}
                              </NavLink>
                              {content.summary && (
                                <p className="mt-3 line-clamp-2 text-sm leading-6" style={{ color: '#707070' }}>
                                  {toPlainTextPreview(content.summary)}
                                </p>
                              )}
                              <p className="mt-3 text-sm" style={{ color: '#909090' }}>
                                {content.author?.name || tc('common:unknownAuthor')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                          {new Date(content.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                          <span className="inline-flex items-center gap-1"><Heart size={14} />{content.like_count}</span>
                        </td>
                        <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                          <span className="inline-flex items-center gap-1"><MessageSquare size={14} />{content.comment_count}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? tc('common:loading') : !hasNextPage && allContents.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default Favorites
