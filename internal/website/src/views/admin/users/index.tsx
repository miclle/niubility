import { useState, useEffect, useCallback, useRef } from 'react'
import { Table, Select, Avatar, TextField } from '@radix-ui/themes'
import { Search, Loader2 } from 'lucide-react'
import dayjs from 'dayjs'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// AdminUsers displays the admin user management page with infinite scroll and search.
function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const limit = 20
  const observerRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Fetch departments once
  useEffect(() => {
    listDepartments().then(res => {
      const map = new Map<number, string>()
      for (const dept of res.data.departments || []) {
        map.set(dept.id, dept.name)
      }
      setDeptMap(map)
    }).catch(() => {})
  }, [])

  // Fetch users
  const fetchUsers = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)

    try {
      const res = await listUsers({ page: pageNum, limit, search })
      const newUsers = res.data.users || []

      if (reset) {
        setUsers(newUsers)
      } else {
        // Deduplicate by id
        setUsers(prev => {
          const existingIds = new Set(prev.map(u => u.id))
          const uniqueNewUsers = newUsers.filter((u: User) => !existingIds.has(u.id))
          return [...prev, ...uniqueNewUsers]
        })
      }

      setTotal(res.data.pagination.total)
      setHasMore(newUsers.length === limit && (pageNum * limit) < res.data.pagination.total)
    } catch {
      if (reset) {
        setUsers([])
      }
      setHasMore(false)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [search])

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setUsers([])
      setHasMore(true)
      fetchUsers(1, true)
    }, 300)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          setPage(prev => {
            const nextPage = prev + 1
            fetchUsers(nextPage)
            return nextPage
          })
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, fetchUsers])

  const handleRoleChange = async (userId: string, role: Role) => {
    try {
      await updateUser(userId, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch {
      // Silently fail
    }
  }

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    try {
      await updateUser(userId, { status })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status } : u))
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>用户管理</h1>
        <div className="text-sm" style={{ color: '#606060' }}>
          共 {total} 个用户
        </div>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <TextField.Root
          placeholder="搜索用户名、姓名、邮箱或手机号..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="2"
          style={{ maxWidth: 400 }}
        >
          <TextField.Slot>
            <Search size={16} style={{ color: '#909090' }} />
          </TextField.Slot>
          {loading && (
            <TextField.Slot>
              <Loader2 size={16} className="animate-spin" style={{ color: '#909090' }} />
            </TextField.Slot>
          )}
        </TextField.Root>
      </div>

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
            {users.length === 0 && !loading ? (
              <Table.Row>
                <Table.Cell colSpan={9} className="text-center py-8" style={{ color: '#909090' }}>
                  {search ? '未找到匹配的用户' : '暂无用户'}
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
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>管理员</span>
                        </Select.Item>
                        <Select.Item value="user">
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#f2f2f2', color: '#606060' }}>普通用户</span>
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </Table.Cell>
                  <Table.Cell>
                    <Select.Root size="1" value={user.status} onValueChange={(val) => handleStatusChange(user.id, val as UserStatus)}>
                      <Select.Trigger variant="ghost" style={{ minWidth: 80 }} />
                      <Select.Content style={{ background: '#ffffff', border: '1px solid #e5e5e5' }}>
                        <Select.Item value="activated">
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#dcfce7', color: '#166534' }}>已激活</span>
                        </Select.Item>
                        <Select.Item value="deactivated">
                          <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>已禁用</span>
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

        {/* Loading indicator and intersection observer target */}
        <div ref={observerRef} className="py-4 text-center">
          {loading && hasMore && (
            <div className="flex items-center justify-center gap-2" style={{ color: '#909090' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载更多...</span>
            </div>
          )}
          {!hasMore && users.length > 0 && (
            <span className="text-sm" style={{ color: '#909090' }}>已加载全部用户</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminUsers
