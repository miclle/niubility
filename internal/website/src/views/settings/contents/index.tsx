import { useState, useRef, useCallback } from 'react'
import { NavLink } from 'react-router-dom'
import { FileText, Play, Image, Pencil, Heart, MessageSquare, Trash2, Send, ArrowDown, Sparkles } from 'lucide-react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { useAppContext } from 'src/context/app'
import { listContents, updateContent, deleteContent } from 'src/api/content'
import { contentDetailPath, contentEditPath, contentNewPath } from 'src/lib/content-url'
import { useIntersection } from 'src/hooks/use-intersection'
import type { Content, ContentStatus, ContentType } from 'src/types/content'

const limit = 20

// MyContents displays the current user's content list with draft/published tabs and infinite scroll.
function MyContents() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { currentUser } = useAppContext()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ContentStatus>('published')
  const [activeType, setActiveType] = useState<ContentType>('video')

  const typeTabs: Array<{ key: ContentType; label: string }> = [
    { key: 'video', label: t('settings:videos') },
    { key: 'gallery', label: t('settings:galleries') },
    { key: 'article', label: t('settings:articles') },
  ]

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['my-contents', { authorId: currentUser?.id, status: activeTab, type: activeType }],
      queryFn: ({ pageParam }) =>
        listContents({
          cursor: pageParam,
          limit,
          author_id: currentUser?.id,
          status: activeTab,
          type: activeType,
        }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
      enabled: !!currentUser,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-contents'] })

  const handlePublish = async (content: Content) => {
    try {
      await updateContent(content.id, { status: 'published' })
      invalidate()
    } catch {
      // Silently fail
    }
  }

  const handleDelete = async (content: Content) => {
    if (!confirm(tc('common:confirmDelete'))) return
    try {
      await deleteContent(content.id)
      invalidate()
    } catch {
      // Silently fail
    }
  }

  const typeIcon = (type: string) => {
    if (type === 'video') return <Play size={20} />
    if (type === 'gallery') return <Image size={20} />
    return <FileText size={20} />
  }

  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-[#ececec] px-6 py-8 lg:px-12">
        <div>
          <h1 className="text-[2rem] font-semibold tracking-tight" style={{ color: '#0f0f0f' }}>
            {t('settings:myContentsTitle')}
          </h1>
          <p className="mt-2 text-sm" style={{ color: '#606060' }}>
            {t('settings:manageProfileAndContent')}
          </p>
        </div>

        <div className="mt-8 flex gap-8 overflow-x-auto border-b border-[#ececec]">
          {typeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveType(tab.key)}
              className="relative shrink-0 pb-4 text-base font-medium transition-colors"
              style={{ color: activeType === tab.key ? '#0f0f0f' : '#6f6f6f' }}
            >
              {tab.label}
              {activeType === tab.key && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ background: '#0f0f0f' }} />
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            onClick={() => setActiveTab('published')}
            style={{
              background: activeTab === 'published' ? '#0f0f0f' : '#f5f5f5',
              color: activeTab === 'published' ? '#ffffff' : '#606060',
            }}
          >
            {t('settings:published')}
          </button>
          <button
            className="rounded-full px-4 py-2 text-sm font-medium transition-colors"
            onClick={() => setActiveTab('draft')}
            style={{
              background: activeTab === 'draft' ? '#0f0f0f' : '#f5f5f5',
              color: activeTab === 'draft' ? '#ffffff' : '#606060',
            }}
          >
            {t('settings:draft')}
          </button>
        </div>
      </div>

      {contents.length === 0 && !loading ? (
        <div className="flex min-h-[460px] flex-col items-center justify-center px-6 text-center lg:px-12">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-[2rem]"
            style={{ background: 'linear-gradient(180deg, #dff8ff 0%, #b5ecff 100%)' }}
          >
            <Sparkles size={72} strokeWidth={1.5} style={{ color: '#1296c9' }} />
          </div>
          <h2 className="mt-8 text-2xl font-semibold" style={{ color: '#0f0f0f' }}>
            {t('settings:emptyContentsTitle')}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6" style={{ color: '#707070' }}>
            {activeTab === 'draft' ? t('settings:noDrafts') : t('settings:emptyContentsDescription')}
          </p>
          <NavLink to={contentNewPath(activeType)} className="mt-8 no-underline">
            <Button
              className="h-11 rounded-full px-6 text-sm font-medium"
              style={{ background: '#0f0f0f', color: '#ffffff' }}
            >
              {t('settings:createContent')}
            </Button>
          </NavLink>
        </div>
      ) : (
        <div className="px-6 pb-8 lg:px-12">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] table-fixed">
              <colgroup>
                <col style={{ width: '42%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '6%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#ececec]">
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:contentColumn')}</th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:statusColumn')}</th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:typeColumn')}</th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#0f0f0f' }}>
                    <span className="inline-flex items-center gap-1">
                      {t('settings:dateColumn')}
                      <ArrowDown size={14} />
                    </span>
                  </th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:likesColumn')}</th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:commentsColumn')}</th>
                  <th className="px-4 py-5 text-left text-sm font-medium" style={{ color: '#606060' }}>{t('settings:actionsColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {contents.map((content) => (
                  <tr key={content.id} className="border-b border-[#f0f0f0] align-top">
                    <td className="px-4 py-5">
                      <div className="flex items-start gap-4">
                        <div
                          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                          style={{ background: '#f5f5f5', color: '#606060' }}
                        >
                          {typeIcon(content.type)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <NavLink
                            to={activeTab === 'draft' ? contentEditPath(content) : contentDetailPath(content)}
                            className="block truncate text-sm font-semibold no-underline hover:underline"
                            style={{ color: '#0f0f0f' }}
                          >
                            {content.title}
                          </NavLink>
                          {content.summary && (
                            <p className="mt-1 line-clamp-2 text-sm leading-6" style={{ color: '#707070' }}>
                              {content.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-xs font-medium"
                        style={content.status === 'draft'
                          ? { background: '#fef3c7', color: '#92400e' }
                          : { background: '#dcfce7', color: '#166534' }}
                      >
                        {content.status === 'draft' ? t('settings:draft') : t('settings:published')}
                      </span>
                    </td>
                    <td className="px-4 py-5 text-sm" style={{ color: '#606060' }}>
                      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1" style={{ background: '#f5f5f5' }}>
                        {typeIcon(content.type)}
                        {tc(`common:${content.type}`)}
                      </span>
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
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-1">
                        {activeTab === 'draft' && (
                          <button
                            onClick={() => handlePublish(content)}
                            className="rounded-xl p-2 transition-colors hover:bg-black/5"
                            style={{ color: '#065fd4' }}
                            title={t('settings:publish')}
                          >
                            <Send size={16} />
                          </button>
                        )}
                        <NavLink
                          to={contentEditPath(content)}
                          className="rounded-xl p-2 transition-colors hover:bg-black/5 no-underline"
                          style={{ color: '#606060' }}
                          title={t('settings:edit')}
                        >
                          <Pencil size={16} />
                        </NavLink>
                        <button
                          onClick={() => handleDelete(content)}
                          className="rounded-xl p-2 transition-colors hover:bg-red-50"
                          style={{ color: '#cc0000' }}
                          title={t('settings:delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? tc('common:loading') : !hasNextPage && contents.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default MyContents
