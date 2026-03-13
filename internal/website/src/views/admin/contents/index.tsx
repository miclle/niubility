import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Table, Button, Badge, AlertDialog, Flex } from '@radix-ui/themes'
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
        <Button
          asChild
          size="2"
          style={{
            background: '#0f0f0f',
            color: '#ffffff',
            borderRadius: '18px',
          }}
        >
          <Link to="/admin/contents/new">
            <Plus size={16} />
            新建内容
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row style={{ background: '#f9f9f9' }}>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>标题</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>类型</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>分类</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>作者</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>创建时间</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>操作</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-8" style={{ color: '#909090' }}>
                  加载中...
                </Table.Cell>
              </Table.Row>
            ) : contents.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center py-8" style={{ color: '#909090' }}>
                  暂无内容
                </Table.Cell>
              </Table.Row>
            ) : (
              contents.map((content) => (
                <Table.Row key={content.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                  <Table.Cell>
                    <span className="font-medium line-clamp-1" style={{ color: '#0f0f0f' }}>{content.title}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: '#f2f2f2',
                        color: '#606060',
                      }}
                    >
                      {typeLabels[content.type]}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <span
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: '#f2f2f2',
                        color: '#606060',
                      }}
                    >
                      {categoryLabels[content.category]}
                    </span>
                  </Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{content.author?.name || '-'}</Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{dayjs(content.created_at).format('YYYY-MM-DD')}</Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      <Button
                        variant="ghost"
                        size="1"
                        asChild
                        style={{ color: '#606060' }}
                      >
                        <Link to={`/admin/contents/${content.id}`}>
                          <Pencil size={14} />
                        </Link>
                      </Button>
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <Button variant="ghost" size="1" style={{ color: '#cc0000' }}>
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="400px" style={{ background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 12 }}>
                          <AlertDialog.Title style={{ color: '#0f0f0f' }}>确认删除</AlertDialog.Title>
                          <AlertDialog.Description style={{ color: '#606060' }}>
                            确定要删除「{content.title}」吗？此操作不可撤销。
                          </AlertDialog.Description>
                          <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                              <Button variant="soft" color="gray" style={{ borderRadius: '18px' }}>取消</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action>
                              <Button
                                variant="solid"
                                color="red"
                                onClick={() => handleDelete(content.id)}
                                style={{ borderRadius: '18px' }}
                              >
                                确认删除
                              </Button>
                            </AlertDialog.Action>
                          </Flex>
                        </AlertDialog.Content>
                      </AlertDialog.Root>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table.Root>
      </div>

      <Pagination page={page} limit={limit} total={total} onChange={setPage} />
    </div>
  )
}

export default AdminContents
