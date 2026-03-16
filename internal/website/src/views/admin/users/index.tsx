import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Loader2, X, Building2, Users } from 'lucide-react'
import dayjs from 'dayjs'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// roleLabels maps role values to Chinese display labels with styles
const roleLabels: Record<Role, { label: string; bg: string; color: string }> = {
  admin: { label: '管理员', bg: '#fef3c7', color: '#92400e' },
  user: { label: '普通用户', bg: '#f2f2f2', color: '#606060' },
}

// statusLabels maps status values to Chinese display labels with styles
const statusLabels: Record<UserStatus, { label: string; bg: string; color: string }> = {
  activated: { label: '已激活', bg: '#dcfce7', color: '#166534' },
  deactivated: { label: '已禁用', bg: '#fee2e2', color: '#991b1b' },
}

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

// DepartmentSidebar renders a tree-structured department list for the sidebar
function DepartmentSidebar({
  departments,
  selectedId,
  onSelect,
}: {
  departments: Department[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set([1]))
  const tree = buildDepartmentTree(departments, 0)

  // Count total users
  const totalUsers = departments.reduce((sum, d) => sum + (d.user_count || 0), 0)

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
    const isSelected = String(node.id) === selectedId

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded transition-colors"
          style={{
            paddingLeft: level * 16 + 8,
            background: isSelected ? '#f2f2f2' : 'transparent',
          }}
          onClick={() => onSelect(String(node.id))}
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
          <span className="text-sm flex-1 truncate" style={{ color: isSelected ? '#0f0f0f' : '#606060', fontWeight: isSelected ? 500 : 400 }}>
            {node.name}
          </span>
          <span className="text-xs" style={{ color: '#909090' }}>
            {node.user_count || 0}
          </span>
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2" style={{ borderBottom: '1px solid #e5e5e5' }}>
        <Building2 size={16} style={{ color: '#606060' }} />
        <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>部门</span>
      </div>

      {/* All departments */}
      <div
        className="flex items-center gap-2 py-2 px-3 cursor-pointer transition-colors"
        style={{ background: !selectedId ? '#f2f2f2' : 'transparent' }}
        onClick={() => onSelect('')}
      >
        <span className="w-4 h-4" />
        <Users size={14} style={{ color: '#606060', flexShrink: 0 }} />
        <span className="text-sm flex-1" style={{ color: !selectedId ? '#0f0f0f' : '#606060', fontWeight: !selectedId ? 500 : 400 }}>
          全部
        </span>
        <span className="text-xs" style={{ color: '#909090' }}>{totalUsers}</span>
      </div>

      {/* Department tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.map(node => renderNode(node))}
      </div>
    </div>
  )
}

// AdminUsers displays the admin user management page with department sidebar and user list.
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
  const selectedDept = departments.find(d => String(d.id) === departmentId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>
          用户管理
          {selectedDept && (
            <span className="text-base font-normal ml-2" style={{ color: '#606060' }}>
              · {selectedDept.name}
            </span>
          )}
        </h1>
        <div className="text-sm" style={{ color: '#606060' }}>
          共 {total} 个用户
        </div>
      </div>

      <div className="flex gap-4">
      {/* Left sidebar - Department tree (sticky) */}
      <div
        className="flex-shrink-0 bg-white rounded-xl overflow-hidden sticky top-0 self-start"
        style={{ width: 240, border: '1px solid #e5e5e5', maxHeight: 'calc(100vh - 80px)' }}
      >
        <DepartmentSidebar
          departments={departments}
          selectedId={departmentId}
          onSelect={(id) => updateFilters('department_id', id)}
        />
      </div>

      {/* Right side - User list */}
      <div className="flex-1 min-w-0">

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative" style={{ minWidth: 280 }}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#909090' }} />
            <Input
              placeholder="搜索用户名、姓名、邮箱或手机号..."
              value={search}
              onChange={(e) => updateFilters('search', e.target.value)}
              className="pl-9"
            />
          </div>

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

        <div className="bg-white rounded-xl" style={{ border: '1px solid #e5e5e5' }}>
            <table style={{ minWidth: 1200, borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 20, background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, minWidth: 180, borderRight: '1px solid #e5e5e5', borderBottom: '1px solid #e5e5e5' }}>用户</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>用户名</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>邮箱</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>手机</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>部门</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>角色</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>状态</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>注册时间</th>
                  <th style={{ background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: '1px solid #e5e5e5' }}>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: '#909090' }}>
                      {hasFilters ? '未找到匹配的用户' : '暂无用户'}
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td style={{ position: 'sticky', left: 0, zIndex: 10, background: '#ffffff', padding: '12px 16px', borderRight: '1px solid #e5e5e5', borderTop: '1px solid #e5e5e5' }}>
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage src={user.avatar} alt={user.name || user.username} />
                            <AvatarFallback>{user.name?.charAt(0) || user.username.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium" style={{ color: '#0f0f0f', whiteSpace: 'nowrap' }}>{user.name || '-'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>{user.username}</td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>{user.email || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>{user.mobile || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>
                        <span className="text-xs" style={{ background: '#f2f2f2', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                          {getDepartmentNames(user.department_ids)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>
                        <Select value={user.role} onValueChange={(val) => handleRoleChange(user.id, val as Role)}>
                          <SelectTrigger size="sm" className="w-24 border-0 bg-transparent shadow-none">
                            <SelectValue>
                              {(() => { const r = roleLabels[user.role]; return r ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: r.bg, color: r.color }}>{r.label}</span> : user.role })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(roleLabels) as [Role, typeof roleLabels[Role]][]).map(([value, { label, bg, color }]) => (
                              <SelectItem key={value} value={value}>
                                <span className="px-2 py-0.5 rounded text-xs" style={{ background: bg, color }}>{label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>
                        <Select value={user.status} onValueChange={(val) => handleStatusChange(user.id, val as UserStatus)}>
                          <SelectTrigger size="sm" className="w-24 border-0 bg-transparent shadow-none">
                            <SelectValue>
                              {(() => { const s = statusLabels[user.status]; return s ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: s.bg, color: s.color }}>{s.label}</span> : user.status })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.entries(statusLabels) as [UserStatus, typeof statusLabels[UserStatus]][]).map(([value, { label, bg, color }]) => (
                              <SelectItem key={value} value={value}>
                                <span className="px-2 py-0.5 rounded text-xs" style={{ background: bg, color }}>{label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>{dayjs(user.created_at).format('YYYY-MM-DD HH:mm')}</td>
                      <td style={{ padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: '1px solid #e5e5e5' }}>{dayjs(user.updated_at).format('YYYY-MM-DD HH:mm')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

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
      </div>
    </div>
  )
}

export default AdminUsers
