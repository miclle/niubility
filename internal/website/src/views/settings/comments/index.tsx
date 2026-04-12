import { useRef, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { Heart, Sparkles } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { listMyComments } from 'src/api/content'
import { getStyledContentCardCover } from 'src/lib/content-assets'
import { contentDetailPath } from 'src/lib/content-url'
import { useIntersection } from 'src/hooks/use-intersection'

const limit = 20

// MyComments displays the current user's comment history with infinite scroll.
function MyComments() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { siteConfig } = useAppContext()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['my-comments'],
      queryFn: ({ pageParam }) => listMyComments({ cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const comments = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <div className="app-surface min-h-full">
      <div className="border-b app-border px-6 py-8 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">
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
          <h2 className="mt-8 text-2xl font-semibold text-foreground">
            {t('settings:myCommentsTitle')}
          </h2>
          <p className="app-text-secondary mt-3 max-w-md text-sm leading-6">
            {t('settings:noComments')}
          </p>
        </div>
      ) : (
        <div className="px-6 py-8 lg:px-12">
          <div className="divide-y app-border">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-5 py-5 first:pt-0">
                {comment.content && (
                  <div className="app-surface-muted h-[68px] w-[120px] shrink-0 overflow-hidden rounded-lg">
                    <NavLink to={contentDetailPath(comment.content)} className="block h-full w-full no-underline">
                      <img
                        src={getStyledContentCardCover(comment.content, siteConfig)}
                        alt={comment.content.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </NavLink>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {comment.content ? (
                        <NavLink
                          to={contentDetailPath(comment.content)}
                          className="block truncate text-[15px] font-medium no-underline hover:underline"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {comment.content.title}
                        </NavLink>
                      ) : (
                        <span className="text-[15px] font-medium" style={{ color: '#909090' }}>
                          {tc('common:unknownAuthor')}
                        </span>
                      )}

                      {comment.content ? (
                        <NavLink
                          to={contentDetailPath(comment.content, `comment-${comment.id}`)}
                          className="mt-2 block text-sm no-underline hover:underline"
                          style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}
                        >
                          {comment.body}
                        </NavLink>
                      ) : (
                        <p className="app-text-secondary mt-2 text-sm" style={{ lineHeight: 1.5 }}>
                          {comment.body}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4">
                    <span className="app-text-tertiary text-sm">
                      {new Date(comment.created_at).toLocaleDateString('zh-CN')}
                    </span>
                    <span className="app-text-tertiary inline-flex items-center gap-1 text-sm">
                      <Heart size={14} />
                      {comment.like_count}
                    </span>
                    {comment.pinned_at ? (
                      <span
                        className="inline-flex rounded-full px-3 py-0.5 text-xs font-medium"
                        style={{ background: '#fef3c7', color: '#92400e' }}
                      >
                        {t('settings:pinned')}
                      </span>
                    ) : (
                      <span
                        className="inline-flex rounded-full px-3 py-0.5 text-xs font-medium"
                        style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
                      >
                        {comment.parent_id !== '' ? t('settings:reply') : t('settings:topLevel')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={loaderRef} className="app-text-tertiary py-4 text-center text-sm">
        {loading ? tc('common:loading') : !hasNextPage && comments.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default MyComments
