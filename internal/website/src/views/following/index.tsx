import { useRef, useCallback } from 'react'
import { UserPlus } from 'lucide-react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { useAppContext } from 'src/context/app'
import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import { useIntersection } from 'src/hooks/use-intersection'

// FollowingFeed displays contents from users that the current user follows.
function FollowingFeed() {
  const { currentUser } = useAppContext()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['contents', { followed_by_user_id: currentUser?.id }],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, limit: 12, followed_by_user_id: currentUser?.id }),
      getNextPageParam: (lastPage) => lastPage.data.pagination.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    })

  const contents = data?.pages.flatMap((p) => p.data.contents) ?? []
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loadMoreRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  return (
    <div className="p-6">
      {contents.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3" style={{ color: '#606060' }}>
          <UserPlus size={48} strokeWidth={1.5} />
          <p className="text-base font-medium" style={{ color: '#0f0f0f' }}>关注感兴趣的人</p>
          <p className="text-sm">关注后，他们发布的内容将出现在这里</p>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} />
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && '加载中...'}
        {!hasNextPage && contents.length > 0 && '没有更多内容了'}
      </div>
    </div>
  )
}

export default FollowingFeed
