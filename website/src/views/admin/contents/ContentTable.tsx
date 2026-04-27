import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Heart, MessageSquare, Play, Image, FileText, Bookmark, Mic, Search, Filter, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

import { listContents, moderateContent, deleteContent } from 'src/api/content'
import { searchUsers } from 'src/api/user'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getSpeakerAvatar, getSpeakerDisplayName, getStyledContentCardCover } from 'src/lib/content-assets'
import { toPlainTextPreview } from 'src/lib/utils'
import { useAppContext } from 'src/context/app'
import { useIntersection } from 'src/hooks/use-intersection'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { Content, ContentReviewStatus, ContentType, ContentVisibility, ListContentsArgs } from 'src/types/content'
import type { SearchUserItem } from 'src/types/user'

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

  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [reviewFilter, setReviewFilter] = useState<ContentReviewStatus | 'all'>('pending')
  const [visibilityFilter, setVisibilityFilter] = useState<ContentVisibility | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draftAuthorKeyword, setDraftAuthorKeyword] = useState('')
  const [selectedAuthor, setSelectedAuthor] = useState<SearchUserItem | null>(null)
  const [authorOptions, setAuthorOptions] = useState<SearchUserItem[]>([])
  const [authorSearching, setAuthorSearching] = useState(false)
  const [editingContent, setEditingContent] = useState<Content | null>(null)
  const [batchModerationOpen, setBatchModerationOpen] = useState(false)
  const [draftReviewStatus, setDraftReviewStatus] = useState<ContentReviewStatus>('pending')
  const [draftVisibility, setDraftVisibility] = useState<ContentVisibility>('private')
  const [draftReviewNote, setDraftReviewNote] = useState('')
  const [selectedContentIDs, setSelectedContentIDs] = useState<string[]>([])

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

  const listParams = useMemo<ListContentsArgs>(() => ({
    limit,
    status: statusFilter,
    type,
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    review_status: reviewFilter,
    visibility: visibilityFilter,
    keyword: keyword.trim() || undefined,
    author_id: selectedAuthor?.id || undefined,
  }), [categoryFilter, keyword, reviewFilter, selectedAuthor?.id, statusFilter, type, visibilityFilter])

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['admin-contents', type, listParams],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, ...listParams }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const contentIDs = useMemo(() => contents.map((content) => content.id), [contents])
  const selectedCount = selectedContentIDs.length
  const allVisibleSelected = contents.length > 0 && selectedCount === contents.length
  const selectedContentSet = useMemo(() => new Set(selectedContentIDs), [selectedContentIDs])
  const pendingCount = contents.filter((content) => content.review_status === 'pending').length
  const activeFilterCount = [
    statusFilter !== 'all',
    reviewFilter !== 'pending',
    visibilityFilter !== 'all',
    categoryFilter !== 'all',
    keyword.trim() !== '',
    selectedAuthor !== null,
  ].filter(Boolean).length

  useEffect(() => {
    setSelectedContentIDs((current) => current.filter((id) => contentIDs.includes(id)))
  }, [contentIDs])

  useEffect(() => {
    const q = draftAuthorKeyword.trim()
    if (!q || (selectedAuthor && q === selectedAuthor.name)) {
      setAuthorOptions([])
      setAuthorSearching(false)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setAuthorSearching(true)
      try {
        const response = await searchUsers(q)
        if (!cancelled) {
          setAuthorOptions(response.data.users)
        }
      } catch {
        if (!cancelled) {
          setAuthorOptions([])
        }
      } finally {
        if (!cancelled) {
          setAuthorSearching(false)
        }
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draftAuthorKeyword, selectedAuthor])

  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id)
      queryClient.invalidateQueries({ queryKey: ['admin-contents', type] })
    } catch {
      // Silently fail
    }
  }

  const resetModerationState = () => {
    setEditingContent(null)
    setBatchModerationOpen(false)
  }

  const openModerationDialog = (content: Content, reviewStatus?: ContentReviewStatus, visibility?: ContentVisibility) => {
    setEditingContent(content)
    setBatchModerationOpen(false)
    setDraftReviewStatus(reviewStatus || content.review_status || 'pending')
    setDraftVisibility(visibility || content.visibility || 'private')
    setDraftReviewNote(content.review_note || '')
  }

  const openBatchModerationDialog = (reviewStatus?: ContentReviewStatus, visibility?: ContentVisibility) => {
    if (selectedCount === 0) return
    setEditingContent(null)
    setBatchModerationOpen(true)
    setDraftReviewStatus(reviewStatus || 'pending')
    setDraftVisibility(visibility || 'private')
    setDraftReviewNote('')
  }

  const handleSaveModeration = async () => {
    const targetIDs = editingContent ? [editingContent.id] : selectedContentIDs
    if (targetIDs.length === 0) return
    try {
      await Promise.all(targetIDs.map((id) => moderateContent(id, {
        review_status: draftReviewStatus,
        visibility: draftVisibility,
        review_note: draftReviewNote.trim(),
      })))
      resetModerationState()
      setSelectedContentIDs([])
      queryClient.invalidateQueries({ queryKey: ['admin-contents', type] })
    } catch {
      // Silently fail
    }
  }

  const toggleSelectContent = (contentID: string, checked: boolean) => {
    setSelectedContentIDs((current) => {
      if (checked) return current.includes(contentID) ? current : [...current, contentID]
      return current.filter((id) => id !== contentID)
    })
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    setSelectedContentIDs(checked ? contentIDs : [])
  }

  const resetFilters = () => {
    setStatusFilter('all')
    setReviewFilter('pending')
    setVisibilityFilter('all')
    setCategoryFilter('all')
    setDraftKeyword('')
    setKeyword('')
    setDraftAuthorKeyword('')
    setSelectedAuthor(null)
    setAuthorOptions([])
  }

  const pickAuthor = (user: SearchUserItem | null) => {
    setSelectedAuthor(user)
    setDraftAuthorKeyword(user?.name || '')
    setAuthorOptions([])
  }

  return (
    <div className="app-surface">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="app-text-secondary text-sm mt-1">{t('admin:moderationWorkbenchDesc')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
              style={pendingCount > 0 ? { background: '#fef3c7', color: '#92400e' } : { background: 'var(--surface-muted)', color: 'var(--text-secondary)' }}
            >
              <ShieldCheck size={14} />
              {t('admin:pendingCount', { count: pendingCount })}
            </span>
            {activeFilterCount > 0 && (
              <Button variant="outline" onClick={resetFilters}>
                {t('admin:clearFilters')}
              </Button>
            )}
          </div>
        </div>

        <div
          className="app-surface-elevated rounded-2xl p-4 border app-border"
          style={{ boxShadow: '0 12px 30px var(--surface-shadow)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-sm font-medium text-foreground">{t('admin:moderationFilters')}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)_repeat(4,minmax(0,0.75fr))]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:searchContent')}</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 app-text-tertiary" />
                <Input
                  value={draftKeyword}
                  onChange={(e) => setDraftKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setKeyword(draftKeyword)
                  }}
                  placeholder={t('admin:searchContentPlaceholder')}
                  className="pl-9"
                />
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:author')}</span>
              <div className="relative">
                <Input
                  value={draftAuthorKeyword}
                  onChange={(e) => {
                    const next = e.target.value
                    setDraftAuthorKeyword(next)
                    if (selectedAuthor && next !== selectedAuthor.name) {
                      setSelectedAuthor(null)
                    }
                  }}
                  placeholder={t('admin:searchAuthorPlaceholder')}
                />
                {(authorSearching || authorOptions.length > 0 || selectedAuthor) && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border app-border bg-background shadow-lg">
                    {selectedAuthor && (
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => pickAuthor(null)}
                      >
                        <span className="font-medium text-foreground">{selectedAuthor.name}</span>
                        <span className="app-text-secondary text-xs">{t('admin:clearAuthorFilter')}</span>
                      </button>
                    )}
                    {!selectedAuthor && authorSearching && (
                      <div className="px-3 py-2 text-sm app-text-secondary">{tc('common:loading')}</div>
                    )}
                    {!selectedAuthor && !authorSearching && authorOptions.length === 0 && draftAuthorKeyword.trim() !== '' && (
                      <div className="px-3 py-2 text-sm app-text-secondary">{t('admin:noAuthorResults')}</div>
                    )}
                    {!selectedAuthor && authorOptions.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => pickAuthor(user)}
                      >
                        <Avatar className="h-6 w-6">
                          <SiteAvatarImage src={user.avatar || ''} alt={user.name} />
                          <AvatarFallback className="text-[11px]">{user.name.charAt(0) || '-'}</AvatarFallback>
                        </Avatar>
                        <span className="truncate text-foreground">{user.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:status')}</span>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {statusFilter === 'all' ? t('admin:all') : statusFilter === 'published' ? t('admin:published') : t('admin:draft')}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin:all')}</SelectItem>
                  <SelectItem value="published">{t('admin:published')}</SelectItem>
                  <SelectItem value="draft">{t('admin:draft')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:category')}</span>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value || 'all')}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {categoryFilter === 'all' ? t('admin:all') : categoryLabels[categoryFilter] || categoryFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin:all')}</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.slug}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:reviewStatus')}</span>
              <Select value={reviewFilter} onValueChange={(value) => setReviewFilter(value as typeof reviewFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {reviewFilter === 'all' ? t('admin:all') : moderationLabel(reviewFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin:all')}</SelectItem>
                  <SelectItem value="pending">{t('admin:pending')}</SelectItem>
                  <SelectItem value="approved">{t('admin:approved')}</SelectItem>
                  <SelectItem value="rejected">{t('admin:rejected')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:visibility')}</span>
              <Select value={visibilityFilter} onValueChange={(value) => setVisibilityFilter(value as typeof visibilityFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {visibilityFilter === 'all' ? t('admin:all') : visibilityLabel(visibilityFilter)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('admin:all')}</SelectItem>
                  <SelectItem value="public">{t('admin:visibilityPublic')}</SelectItem>
                  <SelectItem value="unlisted">{t('admin:visibilityUnlisted')}</SelectItem>
                  <SelectItem value="private">{t('admin:visibilityPrivate')}</SelectItem>
                  <SelectItem value="blocked">{t('admin:visibilityBlocked')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="flex justify-end mt-3">
              <Button onClick={() => setKeyword(draftKeyword)}>
                {t('admin:applyFilters')}
              </Button>
          </div>
        </div>
      </div>

      <div className="app-surface-elevated rounded-xl overflow-hidden border app-border">
        {selectedCount > 0 && (
          <div className="flex flex-col gap-3 border-b app-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm">
              <span className="font-medium text-foreground">{t('admin:selectedCount', { count: selectedCount })}</span>
              <span className="ml-2 app-text-secondary">{t('admin:selectedHint')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => openBatchModerationDialog()}>
                {t('admin:batchModerate')}
              </Button>
              <Button variant="ghost" style={{ color: '#166534' }} onClick={() => openBatchModerationDialog('approved', 'public')}>
                {t('admin:approveAndPublishBatchShort')}
              </Button>
              <Button variant="ghost" style={{ color: '#1d4ed8' }} onClick={() => openBatchModerationDialog('approved', 'unlisted')}>
                {t('admin:approveUnlistedBatchShort')}
              </Button>
              <Button variant="ghost" style={{ color: '#991b1b' }} onClick={() => openBatchModerationDialog('approved', 'blocked')}>
                {t('admin:blockBatchShort')}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedContentIDs([])}>
                {t('admin:clearSelection')}
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1612px]">
            <colgroup>
              <col style={{ width: '52px' }} />
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
              <col style={{ width: '180px' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface-muted)' }}>
                <th style={thStyle}>
                  <input
                    type="checkbox"
                    aria-label={t('admin:selectAllVisible')}
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAllVisible(e.target.checked)}
                    className="h-4 w-4 rounded border app-border"
                  />
                </th>
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
                  <td colSpan={type === 'video' ? 14 : 13} className="app-text-tertiary text-center py-8">
                    {t('admin:noContent')}
                  </td>
                </tr>
              ) : (
                contents.map((content) => {
                  const coverUrl = getStyledContentCardCover(content, siteConfig)
                  const hasSpeakerInfo = Boolean(content.speaker || content.speaker_name)
                  const selected = selectedContentSet.has(content.id)
                  return (
                    <tr key={content.id} style={{ borderTop: '1px solid var(--surface-border)', background: selected ? 'color-mix(in srgb, var(--surface-muted) 65%, white)' : undefined }}>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          aria-label={t('admin:selectContent', { title: content.title })}
                          checked={selected}
                          onChange={(e) => toggleSelectContent(content.id, e.target.checked)}
                          className="h-4 w-4 rounded border app-border"
                        />
                      </td>
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
                            {content.review_note && (
                              <div className="mt-1 inline-flex max-w-full rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#92400e' }}>
                                {t('admin:reviewNotePrefix')}{content.review_note}
                              </div>
                            )}
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
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded text-xs" style={content.review_status === 'approved' ? { background: '#dcfce7', color: '#166534' } : content.review_status === 'rejected' ? { background: '#fee2e2', color: '#991b1b' } : { background: '#fef3c7', color: '#92400e' }}>
                            {moderationLabel(content.review_status)}
                          </span>
                          {content.reviewed_at && (
                            <div className="text-[11px] app-text-tertiary">
                              {dayjs(content.reviewed_at).format('MM-DD HH:mm')}
                            </div>
                          )}
                        </div>
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
                          <Button variant="ghost" style={{ color: '#166534' }} onClick={() => openModerationDialog(content, 'approved', 'public')} title={t('admin:approveAndPublish')}>
                            {t('admin:approveAndPublishShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#1d4ed8' }} onClick={() => openModerationDialog(content, 'approved', 'unlisted')} title={t('admin:approveUnlisted')}>
                            {t('admin:approveUnlistedShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#92400e' }} onClick={() => openModerationDialog(content, 'pending', 'private')} title={t('admin:markPending')}>
                            {t('admin:markPendingShort')}
                          </Button>
                          <Button variant="ghost" style={{ color: '#991b1b' }} onClick={() => openModerationDialog(content, content.review_status === 'rejected' ? 'rejected' : 'approved', 'blocked')} title={t('admin:blockContent')}>
                            {t('admin:blockShort')}
                          </Button>
                          <Button variant="outline" onClick={() => openModerationDialog(content)}>
                            {t('admin:moderate')}
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

      <Dialog open={Boolean(editingContent) || batchModerationOpen} onOpenChange={(open) => { if (!open) resetModerationState() }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingContent ? t('admin:moderationDialogTitle') : t('admin:batchModerationDialogTitle')}</DialogTitle>
            <DialogDescription>
              {editingContent
                ? t('admin:moderationDialogDesc', { title: editingContent.title })
                : t('admin:batchModerationDialogDesc', { count: selectedCount })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium app-text-secondary">{t('admin:reviewStatus')}</span>
                <Select value={draftReviewStatus} onValueChange={(value) => setDraftReviewStatus(value as ContentReviewStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {moderationLabel(draftReviewStatus)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t('admin:pending')}</SelectItem>
                    <SelectItem value="approved">{t('admin:approved')}</SelectItem>
                    <SelectItem value="rejected">{t('admin:rejected')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium app-text-secondary">{t('admin:visibility')}</span>
                <Select value={draftVisibility} onValueChange={(value) => setDraftVisibility(value as ContentVisibility)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {visibilityLabel(draftVisibility)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t('admin:visibilityPrivate')}</SelectItem>
                    <SelectItem value="unlisted">{t('admin:visibilityUnlisted')}</SelectItem>
                    <SelectItem value="public">{t('admin:visibilityPublic')}</SelectItem>
                    <SelectItem value="blocked">{t('admin:visibilityBlocked')}</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium app-text-secondary">{t('admin:reviewNote')}</span>
              <Textarea
                value={draftReviewNote}
                onChange={(e) => setDraftReviewNote(e.target.value)}
                placeholder={t('admin:reviewNotePlaceholder')}
                rows={5}
              />
            </label>

            <div className="rounded-xl border app-border p-3 app-surface-muted">
              <div className="text-xs font-medium text-foreground mb-1">{t('admin:moderationPreview')}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full px-2 py-1" style={draftReviewStatus === 'approved' ? { background: '#dcfce7', color: '#166534' } : draftReviewStatus === 'rejected' ? { background: '#fee2e2', color: '#991b1b' } : { background: '#fef3c7', color: '#92400e' }}>
                  {moderationLabel(draftReviewStatus)}
                </span>
                <span className="rounded-full px-2 py-1" style={draftVisibility === 'public' ? { background: '#dbeafe', color: '#1d4ed8' } : draftVisibility === 'blocked' ? { background: '#fee2e2', color: '#991b1b' } : { background: '#e5e7eb', color: '#374151' }}>
                  {visibilityLabel(draftVisibility)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetModerationState}>
              {tc('common:cancel')}
            </Button>
            <Button onClick={handleSaveModeration}>
              {t('admin:saveModeration')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ContentTable
