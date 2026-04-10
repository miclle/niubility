import { useRef, useCallback } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Mic } from 'lucide-react'

import { listContents } from 'src/api/content'
import ContentCard from 'src/components/ContentCard'
import { useIntersection } from 'src/hooks/use-intersection'
import type { ContentType, ListContentsArgs } from 'src/types/content'
import { getStyledContentCardCover } from 'src/lib/content-assets'
import { contentDetailPath } from 'src/lib/content-url'
import { formatFileSize, toPlainTextPreview } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
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
  const { siteConfig } = useAppContext()
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
          params.profile_user_id = userID
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

  const renderPodcastList = () => (
    <div className="space-y-5">
      {contents.map((content) => {
        const audioItems = (content.attachments || []).filter((item) => item.type === 'audio')

        return (
          <div
            key={content.id}
            className="rounded-3xl bg-white overflow-hidden"
            style={{ border: '1px solid #e5e5e5', boxShadow: '0 18px 40px rgba(15,15,15,0.04)' }}
          >
            <div className="flex flex-col gap-4 p-5 lg:flex-row">
              <Link to={contentDetailPath(content)} className="flex-shrink-0 no-underline" style={{ color: 'inherit' }}>
                <div className="w-full rounded-2xl overflow-hidden bg-zinc-100 lg:w-56" style={{ aspectRatio: '16/9' }}>
                  <img src={getStyledContentCardCover(content, siteConfig)} alt={content.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={contentDetailPath(content)} className="no-underline" style={{ color: 'inherit' }}>
                  <h3 className="text-xl font-semibold mb-2 line-clamp-2" style={{ color: '#0f0f0f', lineHeight: 1.35 }}>{content.title}</h3>
                </Link>
                {content.summary && (
                  <p className="text-sm line-clamp-2 mb-4" style={{ color: '#606060', lineHeight: 1.7 }}>{toPlainTextPreview(content.summary)}</p>
                )}
                <div className="space-y-2.5">
                  {audioItems.map((audio, index) => {
                    const episodePath = `${contentDetailPath(content)}${index === 0 ? '' : `?p=${index}`}`
                    return (
                      <Link
                        key={audio.id}
                        to={episodePath}
                        className="flex items-center gap-3 px-3.5 py-3 rounded-2xl no-underline transition-colors hover:bg-black/5"
                        style={{ color: 'inherit', background: '#fafafa', border: '1px solid #f0f0f0' }}
                      >
                        <div
                          className="flex items-center justify-center flex-shrink-0 rounded-full text-xs font-semibold"
                          style={{ width: 28, height: 28, background: 'rgba(6,95,212,0.08)', color: '#065fd4' }}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: '#0f0f0f' }}>
                            {audio.title || audio.filename || `${t('common:podcast')} ${index + 1}`}
                          </div>
                          <div className="text-xs" style={{ color: '#909090' }}>
                            {audio.file_size > 0 ? formatFileSize(audio.file_size) : '-'}
                          </div>
                        </div>
                        <Mic size={15} style={{ color: '#909090', flexShrink: 0 }} />
                      </Link>
                    )
                  })}
                  {audioItems.length === 0 && (
                    <div className="px-3 py-3 rounded-2xl text-sm" style={{ color: '#909090', background: '#fafafa', border: '1px solid #f0f0f0' }}>
                      {t('common:noContent')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  return (
    <>
      {contents.length === 0 && !loading ? (
        <div className="text-center py-20" style={{ color: '#606060' }}>
          {t('common:noContent')}
        </div>
      ) : (
        tab === 'podcast' ? renderPodcastList() : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {contents.map((content) => (
              <ContentCard key={content.id} content={content} hideAuthor />
            ))}
          </div>
        )
      )}
      <div ref={loadMoreRef} className="text-center py-8" style={{ color: '#606060' }}>
        {loading && t('common:loading')}
        {!hasNextPage && contents.length > 0 && t('common:noMoreContent')}
      </div>
    </>
  )
}
