import { useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listUserFavorites } from 'src/api/user'
import ContentCard from 'src/components/ContentCard'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ProfileContext } from './index'

// ProfileFavorites displays the favorited content grid for a user profile.
export default function ProfileFavorites() {
  const { t } = useTranslation(['profile', 'common'])
  const { profile } = useOutletContext<ProfileContext>()
  const username = profile.user.username

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['profile-favorites', { username }],
      queryFn: ({ pageParam }) => listUserFavorites(username, { cursor: pageParam, limit: 12 }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loadMoreRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <>
      {contents.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          {t('profile:noFavorites')}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && t('common:loading')}
        {!hasNextPage && contents.length > 0 && t('common:noMoreContent')}
      </div>
    </>
  )
}
