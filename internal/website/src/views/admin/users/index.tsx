import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Table, Select, Avatar, TextField, Popover } from '@radix-ui/themes'
import { Search, Loader2, X, ChevronDown, Building2, Check } from 'lucide-react'
import dayjs from 'dayjs'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// DepartmentNode extends Department with children for tree structure
interface DepartmentNode extends Department {
  children?: DepartmentNode[]
}

// buildDepartmentTree converts flat list to tree structure
function buildDepartmentTree(items: Department[], parentId: number = 0): DepartmentNode[] {
  return items
    .filter(item => item.parent_id === parentId)
    .sort((a, b) => a.order - b.order)
    .map(item => ({
      ...item,
      children: buildDepartmentTree(items, item.id),
    }))
}

// DepartmentTreeSelect renders a tree-structured department selector
function DepartmentTreeSelect({
  departments,
  value,
  onChange,
}: {
  departments: Department[]
  value: string
  onChange: (val: string) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1]))
  const tree = buildDepartmentTree(departments, 0)
  const selectedDept = departments.find(d => String(d.id) === value)

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const renderNode = (node: DepartmentNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isSelected = String(node.id) === value

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 py-1.5 px-2 cursor-pointer hover:bg-gray-100 rounded transition-colors"
          style={{ paddingLeft: level * 16 + 8 }}
          onClick={() => onChange(String(node.id))}
        >
          <span
            className="w-4 h-4 flex items-center justify-center flex-shrink-0"
            onClick={(e) => hasChildren && toggleExpand(node.id, e)}
          >
            {hasChildren ? (
              <span
                className="text-xs transition-transform"
                style={{
                  color: '#909090',
                  display: 'inline-block',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▶
              </span>
            ) : (
              <span style={{ width: 8 }} />
            )}
          </span>
          <Building2 size={14} style={{ color: '#606060', flexShrink: 0 }} />
          <span className="text-sm flex-1 truncate" style={{ color: isSelected ? '#0f0f0f' : '#606060' }}>
            {node.name}
          </span>
          {isSelected && <Check size={14} style={{ color: '#0f0f0f' }} />}
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children?.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Popover.Root>
      <Popover.Trigger>
        <button
          className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-sm border"
          style={{
            minWidth: 180,
            background: '#ffffff',
            borderColor: '#e5e5e5',
            color: selectedDept ? '#0f0f0f' : '#909090',
          }}
        >
          <span className="flex items-center gap-2">
            <Building2 size={14} />
            {selectedDept ? selectedDept.name : '选择部门'}
          </span>
          <ChevronDown size={14} style={{ color: '#909090' }} />
        </button>
      </Popover.Trigger>
      <Popover.Content
        style={{
          background: '#ffffff',
          border: '1px solid #e5e5e5',
          borderRadius: 8,
          padding: 8,
          maxHeight: 320,
          overflowY: 'auto',
          minWidth: 240,
        }}
        sideOffset={4}
      >
        {/* All departments option */}
        <div
          className="flex items-center gap-2 py-1.5 px-2 cursor-pointer hover:bg-gray-100 rounded transition-colors"
          onClick={() => onChange('')}
        >
          <span className="w-4 h-4" />
          <span className="text-sm" style={{ color: !value ? '#0f0f0f' : '#606060' }}>
            全部部门
          </span>
          {!value && <Check size={14} style={{ color: '#0f0f0f', marginLeft: 'auto' }} />}
        </div>
        <div style={{ borderTop: '1px solid #e5e5e5', margin: '4px 0' }} />
        {tree.map(node => renderNode(node))}
      </Popover.Content>
    </Popover.Root>
  )
}

// AdminUsers displays the admin user management page with infinite scroll and search.
function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const limit = 20
  const observerRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  // Get filters from URL
  const search = searchParams.get('search') || ''
  const departmentId = searchParams.get('department_id') || ''

  // Fetch departments once
  useEffect(() => {
    listDepartments().then(res => {
      setDepartments(res.data.departments || [])
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
      const res = await listUsers({
        page: pageNum,
        limit,
        search,
        department_id: departmentId ? parseInt(departmentId, 10) : undefined,
      })
      const newUsers = res.data.users || []

      if (reset) {
        setUsers(newUsers)
      } else {
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
  }, [search, departmentId])

  // Reset and fetch when filters change
  useEffect(() => {
    setPage(1)
    setUsers([])
    setHasMore(true)
    fetchUsers(1, true)
  }, [search, departmentId])

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingRef.current) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchUsers(nextPage)
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, page, fetchUsers])

  // Update URL params
  const updateFilters = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    setSearchParams(params, { replace: true })
  }

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

  // Clear all filters
  const clearFilters = () => {
    setSearchParams({}, { replace: true })
  }

  const hasFilters = search || departmentId

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>用户管理</h1>
        <div className="text-sm" style={{ color: '#606060' }}>
          共 {total} 个用户
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <TextField.Root
          placeholder="搜索用户名、姓名、邮箱或手机号..."
          value={search}
          onChange={(e) => updateFilters('search', e.target.value)}
          size="2"
          style={{ minWidth: 280 }}
        >
          <TextField.Slot>
            <Search size={16} style={{ color: '#909090' }} />
          </TextField.Slot>
        </TextField.Root>

        <DepartmentTreeSelect
          departments={departments}
          value={departmentId}
          onChange={(val) => updateFilters('department_id', val)}
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: '#606060', background: '#f2f2f2' }}
          >
            <X size={14} />
            清除筛选
          </button>
        )}

        {loading && (
          <Loader2 size={16} className="animate-spin" style={{ color: '#909090' }} />
        )}
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
                  {hasFilters ? '未找到匹配的用户' : '暂无用户'}
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

        {/* Loading indicator */}
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
