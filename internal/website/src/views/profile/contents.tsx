import { useRef, useCallback } from 'react'
import { useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ContentType, ListContentsArgs } from 'src/types/content'
import type { ProfileContext } from './index'

type ContentTab = 'all' | 'video' | 'gallery' | 'article' | 'speaker' | 'podcast'

// tabFromPath derives the content tab from the current URL pathname suffix.
function tabFromPath(pathname: string): ContentTab {
  const segment = pathname.split('/').pop()
  if (segment === 'videos') return 'video'
  if (segment === 'galleries') return 'gallery'
  if (segment === 'articles') return 'article'
  if (segment === 'podcasts') return 'podcast'
  if (segment === 'speakers') return 'speaker'
  return 'all'
}

// ProfileContents displays the content grid for a user profile (all/video/article/speaker).
export default function ProfileContents() {
  const { t } = useTranslation(['profile', 'common'])
  const { profile } = useOutletContext<ProfileContext>()
  const location = useLocation()
  const tab = tabFromPath(location.pathname)
  const userID = profile.user.id

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['profile-contents', { userID, tab }],
      queryFn: ({ pageParam }) => {
        const params: ListContentsArgs = { cursor: pageParam, limit: 12 }
        if (tab === 'speaker') {
          params.speaker_id = userID
        } else {
          params.author_id = userID
          if (tab === 'video') params.type = 'video' as ContentType
          if (tab === 'gallery') params.type = 'gallery' as ContentType
          if (tab === 'article') params.type = 'article' as ContentType
          if (tab === 'podcast') params.type = 'podcast' as ContentType
        }
        return listContents(params)
      },
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
          {t('common:noContent')}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {contents.map((content) => (
            <ContentCard key={content.id} content={content} hideAuthor />
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
