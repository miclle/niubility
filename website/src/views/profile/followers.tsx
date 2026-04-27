import { useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listFollowers } from 'src/api/user'
import { UserListItem } from './index'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ProfileContext } from './index'

const limit = 20

// ProfileFollowers displays the list of users who follow the profile user.
export default function ProfileFollowers() {
  const { t } = useTranslation(['profile', 'common'])
  const { profile, currentUser } = useOutletContext<ProfileContext>()
  const username = profile.user.username

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['followers', username],
      queryFn: ({ pageParam }) =>
        listFollowers(username, { cursor: pageParam, limit }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const users = data?.pages.flatMap((p) => p.data.items) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loadMoreRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <>
      {users.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          {t('profile:noFollowers')}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {users.map((u) => (
            <UserListItem key={u.id} user={u} currentUserID={currentUser?.id} isFollowingTab={false} />
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && t('common:loading')}
        {!hasNextPage && users.length > 0 && t('common:noMore')}
      </div>
    </>
  )
}
