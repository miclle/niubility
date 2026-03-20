import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'

import { listContents, deleteContent } from 'src/api/content'
import { useAppContext } from 'src/context/app'
import type { Content } from 'src/types/content'

const typeLabels = { article: '图文', video: '视频' } as const
const limit = 20

// AdminContents displays the admin content management page with YouTube-style design.
function AdminContents() {
  const { categories } = useAppContext()
  const categoryLabels = Object.fromEntries(categories.map((c) => [c.slug, c.name]))

  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)
  const hasMore = contents.length < total

  const fetchContents = useCallback(async (p: number, append: boolean) => {
    setLoading(true)
    try {
      const res = await listContents({ page: p, limit })
      const list = res.data.contents || []
      setContents((prev) => append ? [...prev, ...list] : list)
      setTotal(res.data.pagination.total)
    } catch {
      if (!append) setContents([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchContents(1, false)
  }, [fetchContents])

  // Load more when page changes (page > 1)
  useEffect(() => {
    if (page > 1) fetchContents(page, true)
  }, [page, fetchContents])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setPage((p) => p + 1)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading, hasMore])

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id)
      // Reset and reload from page 1
      setPage(1)
      fetchContents(1, false)
    } catch {
      // Silently fail
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>内容管理</h1>
        <Link to="/admin/contents/new">
          <Button
            style={{
              background: '#0f0f0f',
              color: '#ffffff',
              borderRadius: '18px',
            }}
          >
            <Plus size={16} />
            新建内容
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
        <table className="w-full">
          <thead>
            <tr style={{ background: '#f9f9f9' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>标题</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>类型</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>分类</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>作者</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>创建时间</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {contents.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8" style={{ color: '#909090' }}>
                  暂无内容
                </td>
              </tr>
            ) : (
              contents.map((content) => (
                <tr key={content.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/contents/${content.id}`} target="_blank" className="flex items-center gap-3 hover:underline" style={{ color: '#0f0f0f' }}>
                      <div className="w-[72px] h-[40px] rounded overflow-hidden flex-shrink-0" style={{ background: '#f2f2f2' }}>
                        {content.cover_url ? (
                          <img src={content.cover_url} alt="" className="w-full h-full object-cover" />
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
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: '#f2f2f2',
                        color: '#606060',
                      }}
                    >
                      {typeLabels[content.type]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: '#f2f2f2',
                        color: '#606060',
                      }}
                    >
                      {categoryLabels[content.category] || content.category}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap' }}>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={content.author?.avatar || ''} alt={content.author?.name || ''} />
                        <AvatarFallback className="text-xs">{content.author?.name?.charAt(0) || '-'}</AvatarFallback>
                      </Avatar>
                      {content.author?.name || '-'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap' }}>{dayjs(content.created_at).format('YYYY-MM-DD')}</td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div className="flex gap-2">
                      <Link to={`/admin/contents/${content.id}`}>
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
                              <Button
                                variant="destructive"
                                onClick={() => handleDelete(content.id)}
                                style={{ borderRadius: '18px' }}
                              >
                                确认删除
                              </Button>
                            </AlertDialogAction>
                          </div>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div ref={loaderRef} className="py-4 text-center text-sm" style={{ color: '#909090' }}>
        {loading ? '加载中...' : hasMore ? '' : contents.length > 0 ? '没有更多了' : ''}
      </div>
    </div>
  )
}

export default AdminContents
