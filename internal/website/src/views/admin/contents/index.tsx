import { useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Pencil, Trash2, Heart, MessageSquare, Play, Image, FileText, Bookmark } from 'lucide-react'
import dayjs from 'dayjs'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'

import { listContents, deleteContent } from 'src/api/content'
import { contentDetailPath, contentEditPath } from 'src/lib/content-url'
import { getContentCover, getSpeakerAvatar, getSpeakerDisplayName } from 'src/lib/content-assets'
import { useAppContext } from 'src/context/app'
import { useIntersection } from 'src/hooks/use-intersection'

const typeLabels: Record<string, string> = { video: '视频', gallery: '图集', article: '文章' }
const typeIcons: Record<string, React.ReactNode> = {
  video: <Play size={12} />,
  gallery: <Image size={12} />,
  article: <FileText size={12} />,
}
const limit = 20

// Table cell styles
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap' }
const columnCount = 11

// AdminContents displays the admin content management page.
function AdminContents() {
  const { categories, siteConfig } = useAppContext()
  const queryClient = useQueryClient()
  const categoryLabels = Object.fromEntries(categories.map((c) => [c.slug, c.name]))

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['admin-contents'],
      queryFn: ({ pageParam }) =>
        listContents({ cursor: pageParam, limit, status: 'all' }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const contents = data?.pages.flatMap((p) => p.data.items) ?? []
  const loaderRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(loaderRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id)
      queryClient.invalidateQueries({ queryKey: ['admin-contents'] })
    } catch {
      // Silently fail
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>内容管理</h1>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={thStyle}>标题</th>
              <th style={thStyle}>类型</th>
              <th style={thStyle}>状态</th>
              <th style={thStyle}>分类</th>
              <th style={thStyle}>作者</th>
              <th style={thStyle}>Speaker</th>
              <th style={thStyle}>点赞</th>
              <th style={thStyle}>评论</th>
              <th style={thStyle}>收藏</th>
              <th style={thStyle}>创建时间</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {contents.length === 0 && !loading ? (
              <tr>
                <td colSpan={columnCount} className="text-center py-8" style={{ color: '#909090' }}>
                  暂无内容
                </td>
              </tr>
            ) : (
              contents.map((content) => {
                const coverUrl = getContentCover(content, siteConfig)
                const hasSpeakerInfo = Boolean(content.speaker || content.speaker_name)
                return (
                  <tr key={content.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <Link to={contentDetailPath(content)} target="_blank" className="flex items-center gap-3 hover:underline" style={{ color: '#0f0f0f' }}>
                        <div className="w-[72px] h-[40px] rounded overflow-hidden flex-shrink-0" style={{ background: '#f2f2f2' }}>
                          {coverUrl ? (
                            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#909090' }}>无封面</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium line-clamp-1">{content.title}</div>
                          {content.summary && <div className="text-xs line-clamp-1" style={{ color: '#909090' }}>{content.summary}</div>}
                        </div>
                      </Link>
                    </td>
                    <td style={tdStyle}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" style={{ background: '#f2f2f2', color: '#606060' }}>
                        {typeIcons[content.type]}
                        {typeLabels[content.type] || content.type}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="px-2 py-0.5 rounded text-xs" style={content.status === 'draft' ? { background: '#fef3c7', color: '#92400e' } : { background: '#d1fae5', color: '#065f46' }}>
                        {content.status === 'draft' ? '草稿' : '已发布'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#f2f2f2', color: '#606060' }}>
                        {categoryLabels[content.category] || content.category}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={content.author?.avatar || ''} alt={content.author?.name || ''} />
                          <AvatarFallback className="text-xs">{content.author?.name?.charAt(0) || '-'}</AvatarFallback>
                        </Avatar>
                        {content.author?.name || '-'}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {hasSpeakerInfo ? (
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={getSpeakerAvatar(content, siteConfig)} alt={getSpeakerDisplayName(content)} />
                            <AvatarFallback className="text-xs">{getSpeakerDisplayName(content).charAt(0) || '-'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate">{getSpeakerDisplayName(content)}</div>
                            {content.speaker_bio && (
                              <div className="text-xs truncate" style={{ color: '#909090' }}>
                                {content.speaker_bio}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
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
                      <div className="flex gap-2">
                        <Link to={contentEditPath(content)}>
                          <Button variant="ghost" style={{ color: '#606060' }}>
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
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除「{content.title}」吗？此操作不可撤销。
                            </AlertDialogDescription>
                            <div className="flex justify-end gap-3 mt-4">
                              <AlertDialogCancel>
                                <Button variant="outline" style={{ borderRadius: '18px' }}>取消</Button>
                              </AlertDialogCancel>
                              <AlertDialogAction>
                                <Button variant="destructive" onClick={() => handleDelete(content.id)} style={{ borderRadius: '18px' }}>
                                  确认删除
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

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? '加载中...' : !hasNextPage && contents.length > 0 ? '没有更多了' : ''}
      </div>
    </div>
  )
}

export default AdminContents
