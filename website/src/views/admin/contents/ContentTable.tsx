import { useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Heart, MessageSquare, Play, Image, FileText, Bookmark, Mic } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'

import { listContents, moderateContent, deleteContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getSpeakerAvatar, getSpeakerDisplayName, getStyledContentCardCover } from 'src/lib/content-assets'
import { toPlainTextPreview } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import { useIntersection } from 'src/hooks/use-intersection'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { Content, ContentReviewStatus, ContentType, ContentVisibility } from 'src/types/content'

const typeIcons: Record<ContentType, React.ReactNode> = {
  video: <Play size={12} />,
  gallery: <Image size={12} />,
  article: <FileText size={12} />,
  podcast: <Mic size={12} />,
}
const limit = 20

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  color: 'var(--text-secondary)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  verticalAlign: 'top',
}

export interface ContentTableProps {
  type: ContentType
  title: string
}

function ContentTable({ type, title }: ContentTableProps) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { categories, siteConfig } = useAppContext()
  const queryClient = useQueryClient()
  const categoryLabels = Object.fromEntries(categories.map((c) => [c.slug, c.name]))

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['admin-contents', type],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, limit, status: 'all', type }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage
  const moderationLabel = (status: ContentReviewStatus) => {
    if (status === 'approved') return t('admin:approved')
    if (status === 'rejected') return t('admin:rejected')
    return t('admin:pending')
  }
  const visibilityLabel = (visibility: ContentVisibility) => {
    if (visibility === 'public') return t('admin:visibilityPublic')
    if (visibility === 'unlisted') return t('admin:visibilityUnlisted')
    if (visibility === 'blocked') return t('admin:visibilityBlocked')
    return t('admin:visibilityPrivate')
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id)
      queryClient.invalidateQueries({ queryKey: ['admin-contents', type] })
    } catch {
      // Silently fail
    }
  }

  const handleModerate = async (content: Content, reviewStatus: ContentReviewStatus, visibility: ContentVisibility) => {
    try {
      await moderateContent(content.id, {
        review_status: reviewStatus,
        visibility,
        review_note: content.review_note || '',
      })
      queryClient.invalidateQueries({ queryKey: ['admin-contents', type] })
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="app-surface">
      <h1 className="text-xl font-semibold mb-6 text-foreground">{title}</h1>

      <div className="app-surface-elevated rounded-xl overflow-hidden border app-border">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1560px]">
            <colgroup>
              <col style={{ width: '320px' }} />
              <col style={{ width: '92px' }} />
              <col style={{ width: '96px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '160px' }} />
              {type === 'video' && <col style={{ width: '240px' }} />}
              <col style={{ width: '76px' }} />
              <col style={{ width: '76px' }} />
              <col style={{ width: '76px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '110px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                <th style={thStyle}>{t('admin:title')}</th>
                <th style={thStyle}>{t('admin:type')}</th>
                <th style={thStyle}>{t('admin:status')}</th>
                <th style={thStyle}>{t('admin:reviewStatus')}</th>
                <th style={thStyle}>{t('admin:visibility')}</th>
                <th style={thStyle}>{t('admin:category')}</th>
                <th style={thStyle}>{t('admin:author')}</th>
                {type === 'video' && <th style={thStyle}>Speaker</th>}
                <th style={thStyle}>{t('admin:likes')}</th>
                <th style={thStyle}>{t('admin:comments')}</th>
                <th style={thStyle}>{t('admin:favorites')}</th>
                <th style={thStyle}>{t('admin:createdAt')}</th>
                <th style={thStyle}>{t('admin:actions')}</th>
              </tr>
            </thead>
            <tbody>
              {contents.length === 0 && !loading ? (
                <tr>
                  <td colSpan={type === 'video' ? 13 : 12} className="app-text-tertiary text-center py-8">
                    {t('admin:noContent')}
                  </td>
                </tr>
              ) : (
                contents.map((content) => {
                  const coverUrl = getStyledContentCardCover(content, siteConfig)
                  const hasSpeakerInfo = Boolean(content.speaker || content.speaker_name)
                  return (
                    <tr key={content.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                      <td style={{ ...tdStyle, whiteSpace: 'normal' }}>
                        <Link to={contentDetailPath(content)} target="_blank" className="flex items-center gap-3 hover:underline" style={{ color: 'var(--foreground)' }}>
                          <div className="app-surface-muted w-[72px] h-[40px] rounded overflow-hidden flex-shrink-0">
                            {coverUrl ? (
                              <img src={coverUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="app-text-tertiary w-full h-full flex items-center justify-center text-xs">{t('admin:noCover')}</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <div className="font-medium line-clamp-1">{content.title}</div>
                            {content.summary && <div className="app-text-tertiary text-xs line-clamp-1">{toPlainTextPreview(content.summary)}</div>}
                          </div>
                        </Link>
                      </td>
                      <td style={tdStyle}>
                        <span className="app-surface-muted inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {typeIcons[content.type]}
                          {tc(content.type)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="px-2 py-0.5 rounded text-xs" style={content.status === 'draft' ? { background: '#fef3c7', color: '#92400e' } : { background: '#d1fae5', color: '#065f46' }}>
                          {content.status === 'draft' ? t('admin:draft') : t('admin:published')}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="px-2 py-0.5 rounded text-xs" style={content.review_status === 'approved' ? { background: '#dcfce7', color: '#166534' } : content.review_status === 'rejected' ? { background: '#fee2e2', color: '#991b1b' } : { background: '#fef3c7', color: '#92400e' }}>
                          {moderationLabel(content.review_status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="px-2 py-0.5 rounded text-xs" style={content.visibility === 'public' ? { background: '#dbeafe', color: '#1d4ed8' } : content.visibility === 'blocked' ? { background: '#fee2e2', color: '#991b1b' } : { background: '#e5e7eb', color: '#374151' }}>
                          {visibilityLabel(content.visibility)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span className="app-surface-muted px-2 py-0.5 rounded text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {categoryLabels[content.category] || content.category}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="w-6 h-6 flex-shrink-0">
                            <SiteAvatarImage src={content.author?.avatar || ''} alt={content.author?.name || ''} />
                            <AvatarFallback className="text-xs">{content.author?.name?.charAt(0) || '-'}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{content.author?.name || '-'}</span>
                        </div>
                      </td>
                      {type === 'video' && (
                        <td style={{ ...tdStyle, whiteSpace: 'normal' }}>
                          {hasSpeakerInfo ? (
                            <div className="flex items-start gap-2 min-w-0 max-w-[208px]">
                              <Avatar className="w-6 h-6 flex-shrink-0">
                                <SiteAvatarImage src={getSpeakerAvatar(content, siteConfig)} alt={getSpeakerDisplayName(content)} />
                                <AvatarFallback className="text-xs">{getSpeakerDisplayName(content).charAt(0) || '-'}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 overflow-hidden">
                                <div className="truncate">{getSpeakerDisplayName(content)}</div>
                                {content.speaker_bio && (
                                  <div
                                    className="text-xs overflow-hidden"
                                    style={{
                                      color: 'var(--text-tertiary)',
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflowWrap: 'anywhere',
                                    }}
                                    title={content.speaker_bio}
                                  >
                                    {content.speaker_bio}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td style={tdStyle}>
                        <span className="flex items-center gap-1 text-xs"><Heart size={12} />{content.like_count}</span>
                      </td>
                      <td style={tdStyle}>
                        <span className="flex items-center gap-1 text-xs"><MessageSquare size={12} />{content.comment_count}</span>
                      </td>
                      <td style={tdStyle}>
                        <span className="flex items-center gap-1 text-xs"><Bookmark size={12} />{content.favorite_count}</span>
                      </td>
                      <td style={tdStyle}>{dayjs(content.created_at).format('YYYY-MM-DD')}</td>
                      <td style={tdStyle}>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="ghost" style={{ color: '#166534' }} onClick={() => handleModerate(content, 'approved', 'public')} title={t('admin:approveAndPublish')}>
                            {t('admin:approveAndPublishShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#1d4ed8' }} onClick={() => handleModerate(content, 'approved', 'unlisted')} title={t('admin:approveUnlisted')}>
                            {t('admin:approveUnlistedShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#92400e' }} onClick={() => handleModerate(content, 'pending', 'private')} title={t('admin:markPending')}>
                            {t('admin:markPendingShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#991b1b' }} onClick={() => handleModerate(content, content.review_status === 'rejected' ? 'rejected' : 'approved', 'blocked')} title={t('admin:blockContent')}>
                            {t('admin:blockShort')}
                          </Button>
                          <Link to={contentEditPath(content)}>
                            <Button variant="ghost" style={{ color: 'var(--text-secondary)' }}>
                              <Pencil size={14} />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger render={
                              <Button variant="ghost" style={{ color: '#cc0000' }}>
                                <Trash2 size={14} />
                              </Button>
                            } />
                            <AlertDialogContent>
                              <AlertDialogTitle>{tc('common:confirm')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('admin:confirmDeleteContent', { title: content.title })}
                              </AlertDialogDescription>
                              <div className="flex justify-end gap-3 mt-4">
                                <AlertDialogCancel>
                                  <Button variant="outline" style={{ borderRadius: '18px' }}>{tc('common:cancel')}</Button>
                                </AlertDialogCancel>
                                <AlertDialogAction>
                                  <Button variant="destructive" onClick={() => handleDelete(content.id)} style={{ borderRadius: '18px' }}>
                                    {tc('common:confirm')}
                                  </Button>
                                </AlertDialogAction>
                              </div>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={loaderRef} className="app-text-tertiary py-4 text-center text-sm">
        {loading ? tc('common:loading') : !hasNextPage && contents.length > 0 ? tc('common:noMoreContent') : ''}
      </div>
    </div>
  )
}

export default ContentTable
