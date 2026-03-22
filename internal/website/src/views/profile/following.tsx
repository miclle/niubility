import { useRef, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listFollowing } from 'src/api/user'
import { UserListItem } from './index'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ProfileContext } from './index'

const limit = 20

// ProfileFollowing displays the list of users that the profile user is following.
export default function ProfileFollowing() {
  const { profile, currentUser } = useOutletContext<ProfileContext>()
  const username = profile.user.username

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['following', username],
      queryFn: ({ pageParam }) =>
        listFollowing(username, { cursor: pageParam, limit }),
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
          暂未关注任何人
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          {users.map((u) => (
            <UserListItem key={u.id} user={u} currentUserID={currentUser?.id} isFollowingTab />
          ))}
        </div>
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && '加载中...'}
        {!hasNextPage && users.length > 0 && '没有更多了'}
      </div>
    </>
  )
}
