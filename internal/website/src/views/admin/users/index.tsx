import { useState, useEffect, useCallback } from 'react'
import { Table, Select, Avatar } from '@radix-ui/themes'
import dayjs from 'dayjs'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import Pagination from 'src/components/Pagination'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// AdminUsers displays the admin user management page with YouTube-style design.
function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const limit = 20

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await listDepartments()
      setDepartments(res.data.departments || [])
      const map = new Map<number, string>()
      for (const dept of res.data.departments || []) {
        map.set(dept.id, dept.name)
      }
      setDeptMap(map)
    } catch {
      // Silently fail
    }
  }, [])

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
    fetchDepartments()
  }, [fetchDepartments])

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

  // getDepartmentNames converts comma-separated department IDs to names
  const getDepartmentNames = (deptIDs: string): string => {
    if (!deptIDs) return '-'
    const ids = deptIDs.split(',').map(id => parseInt(id.trim(), 10))
    const names = ids.map(id => deptMap.get(id) || `#${id}`).filter(Boolean)
    return names.join(', ') || '-'
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>用户管理</h1>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e5e5' }}>
        <Table.Root>
          <Table.Header>
            <Table.Row style={{ background: '#f9f9f9' }}>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>用户</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>用户名</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>邮箱</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>手机</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>部门</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>角色</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>状态</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>注册时间</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell style={{ color: '#606060', fontWeight: 500 }}>更新时间</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <Table.Row>
                <Table.Cell colSpan={9} className="text-center py-8" style={{ color: '#909090' }}>
                  加载中...
                </Table.Cell>
              </Table.Row>
            ) : users.length === 0 ? (
              <Table.Row>
                <Table.Cell colSpan={9} className="text-center py-8" style={{ color: '#909090' }}>
                  暂无用户
                </Table.Cell>
              </Table.Row>
            ) : (
              users.map((user) => (
                <Table.Row key={user.id} style={{ borderTop: '1px solid #e5e5e5' }}>
                  <Table.Cell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        size="2"
                        radius="full"
                        src={user.avatar}
                        fallback={user.name?.charAt(0) || user.username.charAt(0)}
                        style={{ width: 32, height: 32 }}
                      />
                      <span className="font-medium" style={{ color: '#0f0f0f' }}>{user.name || '-'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{user.username}</Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{user.email || '-'}</Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{user.mobile || '-'}</Table.Cell>
                  <Table.Cell style={{ color: '#606060', maxWidth: 150 }}>
                    <span className="text-xs" style={{ background: '#f2f2f2', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                      {getDepartmentNames(user.department_ids)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <Select.Root size="1" value={user.role} onValueChange={(val) => handleRoleChange(user.id, val as Role)}>
                      <Select.Trigger variant="ghost" style={{ minWidth: 80 }} />
                      <Select.Content style={{ background: '#ffffff', border: '1px solid #e5e5e5' }}>
                        <Select.Item value="admin">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: '#fef3c7', color: '#92400e' }}
                          >
                            管理员
                          </span>
                        </Select.Item>
                        <Select.Item value="user">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: '#f2f2f2', color: '#606060' }}
                          >
                            普通用户
                          </span>
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Select.Root size="1" value={user.status} onValueChange={(val) => handleStatusChange(user.id, val as UserStatus)}>
                      <Select.Trigger variant="ghost" style={{ minWidth: 80 }} />
                      <Select.Content style={{ background: '#ffffff', border: '1px solid #e5e5e5' }}>
                        <Select.Item value="activated">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: '#dcfce7', color: '#166534' }}
                          >
                            已激活
                          </span>
                        </Select.Item>
                        <Select.Item value="deactivated">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: '#fee2e2', color: '#991b1b' }}
                          >
                            已禁用
                          </span>
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{dayjs(user.created_at).format('YYYY-MM-DD HH:mm')}</Table.Cell>
                  <Table.Cell style={{ color: '#606060' }}>{dayjs(user.updated_at).format('YYYY-MM-DD HH:mm')}</Table.Cell>
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
