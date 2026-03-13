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

// AdminContents displays the admin content management page.
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
        <h1 className="text-2xl font-bold text-gray-900">内容管理</h1>
        <Button asChild size="2">
          <Link to="/admin/contents/new">
            <Plus size={16} />
            新建内容
          </Link>
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>标题</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>类型</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>分类</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>作者</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>创建时间</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>操作</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center text-gray-400 py-8">
                  加载中...
                </Table.Cell>
              </Table.Row>
            ) : contents.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center text-gray-400 py-8">
                  暂无内容
                </Table.Cell>
              </Table.Row>
            ) : (
              contents.map((content) => (
                <Table.Row key={content.id}>
                  <Table.Cell>
                    <span className="font-medium text-gray-900 line-clamp-1">{content.title}</span>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft">{typeLabels[content.type]}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="outline">{categoryLabels[content.category]}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-gray-500">{content.author?.name || '-'}</Table.Cell>
                  <Table.Cell className="text-gray-500">{dayjs(content.created_at).format('YYYY-MM-DD')}</Table.Cell>
                  <Table.Cell>
                    <Flex gap="2">
                      <Button variant="ghost" size="1" asChild>
                        <Link to={`/admin/contents/${content.id}`}>
                          <Pencil size={14} />
                        </Link>
                      </Button>
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>
                          <Button variant="ghost" size="1" color="red">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialog.Trigger>
                        <AlertDialog.Content maxWidth="400px">
                          <AlertDialog.Title>确认删除</AlertDialog.Title>
                          <AlertDialog.Description>确定要删除「{content.title}」吗？此操作不可撤销。</AlertDialog.Description>
                          <Flex gap="3" mt="4" justify="end">
                            <AlertDialog.Cancel>
                              <Button variant="soft" color="gray">取消</Button>
                            </AlertDialog.Cancel>
                            <AlertDialog.Action>
                              <Button variant="solid" color="red" onClick={() => handleDelete(content.id)}>确认删除</Button>
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
