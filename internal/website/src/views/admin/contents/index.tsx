import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import dayjs from 'dayjs'

import { listContents, deleteContent } from 'src/api/content'
import Pagination from 'src/components/Pagination'
import type { Content } from 'src/types/content'

const categoryLabels = { learning: '学习交流', culture: '企业文化' } as const
const typeLabels = { article: '图文', video: '视频' } as const

// AdminContents displays the admin content management page with YouTube-style design.
function AdminContents() {
  const [contents, setContents] = useState<Content[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 20

  const fetchContents = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listContents({ page, limit })
      setContents(res.data.contents || [])
      setTotal(res.data.pagination.total)
    } catch {
      setContents([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchContents()
  }, [fetchContents])

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id)
      fetchContents()
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
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-8" style={{ color: '#909090' }}>
                  加载中...
                </td>
              </tr>
            ) : contents.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8" style={{ color: '#909090' }}>
                  暂无内容
                </td>
              </tr>
            ) : (
              contents.map((content) => (
                <tr key={content.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <Link to={`/contents/${content.id}`} target="_blank" className="font-medium line-clamp-1 hover:underline" style={{ color: '#0f0f0f' }}>{content.title}</Link>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
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
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: '#f2f2f2',
                        color: '#606060',
                      }}
                    >
                      {categoryLabels[content.category]}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#606060' }}>{content.author?.name || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#606060' }}>{dayjs(content.created_at).format('YYYY-MM-DD')}</td>
                  <td style={{ padding: '12px 16px' }}>
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

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />
    </div>
  )
}

export default AdminContents
