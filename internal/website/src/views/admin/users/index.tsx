import { useState, useEffect, useCallback } from 'react'
import { Table, Badge, Select, Avatar } from '@radix-ui/themes'
import dayjs from 'dayjs'

import { listUsers, updateUser } from 'src/api/user'
import Pagination from 'src/components/Pagination'
import type { User, Role, UserStatus } from 'src/types/user'

// AdminUsers displays the admin user management page.
function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 20

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listUsers({ page, limit })
      setUsers(res.data.users || [])
      setTotal(res.data.pagination.total)
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleRoleChange = async (userId: string, role: Role) => {
    try {
      await updateUser(userId, { role })
      fetchUsers()
    } catch {
      // Silently fail
    }
  }

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    try {
      await updateUser(userId, { status })
      fetchUsers()
    } catch {
      // Silently fail
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">用户管理</h1>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>用户</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>用户名</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>邮箱</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>角色</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>注册时间</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center text-gray-400 py-8">
                  加载中...
                </Table.Cell>
              </Table.Row>
            ) : users.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={6} className="text-center text-gray-400 py-8">
                  暂无用户
                </Table.Cell>
              </Table.Row>
            ) : (
              users.map((user) => (
                <Table.Row key={user.id}>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      <Avatar size="2" radius="full" src={user.avatar} fallback={user.name?.charAt(0) || user.username.charAt(0)} />
                      <span className="font-medium text-gray-900">{user.name || '-'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell className="text-gray-500">{user.username}</Table.Cell>
                  <Table.Cell className="text-gray-500">{user.email || '-'}</Table.Cell>
                  <Table.Cell>
                    <Select.Root size="1" value={user.role} onValueChange={(val) => handleRoleChange(user.id, val as Role)}>
                      <Select.Trigger variant="ghost" />
                      <Select.Content>
                        <Select.Item value="admin">
                          <Badge color="orange">管理员</Badge>
                        </Select.Item>
                        <Select.Item value="user">
                          <Badge color="gray">普通用户</Badge>
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Select.Root size="1" value={user.status} onValueChange={(val) => handleStatusChange(user.id, val as UserStatus)}>
                      <Select.Trigger variant="ghost" />
                      <Select.Content>
                        <Select.Item value="activated">
                          <Badge color="green">已激活</Badge>
                        </Select.Item>
                        <Select.Item value="deactivated">
                          <Badge color="red">已禁用</Badge>
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Table.Cell>
                  <Table.Cell className="text-gray-500">{dayjs(user.created_at).format('YYYY-MM-DD')}</Table.Cell>
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

export default AdminUsers
