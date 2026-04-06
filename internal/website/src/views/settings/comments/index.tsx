import { useRef, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { Heart, ArrowDown, Sparkles } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { listMyComments } from 'src/api/content'
import { getContentCover } from 'src/lib/content-assets'
import { contentDetailPath } from 'src/lib/content-url'
import { useIntersection } from 'src/hooks/use-intersection'

const limit = 20

// MyComments displays the current user's comment history with infinite scroll.
function MyComments() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { currentUser, siteConfig } = useAppContext()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['my-comments'],
      queryFn: ({ pageParam }) => listMyComments({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    })

  const comments = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <div className="min-h-full bg-white">
      <div className="px-6 pt-8 pb-0 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight" style={{ color: '#0f0f0f' }}>
          {t('settings:myCommentsTitle')}
        </h1>
      </div>

      {comments.length === 0 && !loading ? (
        <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center lg:px-12">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-[2rem]"
            style={{ background: 'linear-gradient(180deg, #dff8ff 0%, #b5ecff 100%)' }}
          >
            <Sparkles size={72} strokeWidth={1.5} style={{ color: '#1296c9' }} />
          </div>
          <h2 className="mt-8 text-2xl font-semibold" style={{ color: '#0f0f0f' }}>
            {t('settings:myCommentsTitle')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6" style={{ color: '#707070' }}>
            {t('settings:noComments')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] table-fixed">
            <colgroup>
              <col style={{ width: '120px' }} />
              <col style={{ width: '100%' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-[#ececec]">
                <th className="px-6 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>
                  {' '}
                </th>
                <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>
                  {t('settings:contentColumn')}
                </th>
                <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#0f0f0f' }}>
                  <span className="inline-flex items-center gap-1">
                    {t('settings:dateColumn')}
                    <ArrowDown size={14} />
                  </span>
                </th>
                <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>
                  {t('settings:likesColumn')}
                </th>
                <th className="px-4 py-6 text-left text-sm font-semibold" style={{ color: '#606060' }}>
                  {t('settings:statusColumn')}
                </th>
              </tr>
            </thead>
            <tbody>
              {comments.map((comment) => (
                <>
                  <tr key={`${comment.id}-title`} className="border-b border-[#ececec]">
                    <td className="px-6 py-5 align-top" rowSpan={2}>
                      {comment.content && (
                        <div className="h-16 w-[88px] overflow-hidden rounded-xl bg-[#f5f5f5]">
                          <NavLink to={contentDetailPath(comment.content)} className="block h-full w-full no-underline">
                            <img
                              src={getContentCover(comment.content, siteConfig)}
                              alt={comment.content.title}
                              className="h-full w-full object-cover"
                            />
                          </NavLink>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-5 align-top">
                      {comment.content ? (
                        <NavLink
                          to={contentDetailPath(comment.content)}
                          className="block truncate text-[15px] font-medium no-underline hover:underline"
                          style={{ color: '#0f0f0f' }}
                        >
                          {comment.content.title}
                        </NavLink>
                      ) : (
                        <span className="text-[15px] font-medium" style={{ color: '#909090' }}>
                          {tc('common:unknownAuthor')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                      {new Date(comment.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                      <span className="inline-flex items-center gap-1">
                        <Heart size={14} />
                        {comment.like_count}
                      </span>
                    </td>
                    <td className="px-4 py-5">
                      {comment.pinned_at ? (
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
                          style={{ background: '#fef3c7', color: '#92400e' }}
                        >
                          {t('settings:pinned')}
                        </span>
                      ) : (
                        <span
                          className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
                          style={{ background: '#f5f5f5', color: '#606060' }}
                        >
                          {comment.parent_id !== '' ? t('settings:reply') : t('settings:topLevel')}
                        </span>
                      )}
                    </td>
                  </tr>
                  <tr key={`${comment.id}-body`}>
                    <td colSpan={4} className="px-4 py-3 text-sm leading-6" style={{ color: '#707070' }}>
                      {comment.body}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? tc('common:loading') : !hasNextPage && comments.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default MyComments
