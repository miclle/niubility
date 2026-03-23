import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, Loader2, X, Building2, Users } from 'lucide-react'
import dayjs from 'dayjs'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import { useIntersection } from 'src/hooks/use-intersection'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// roleLabels maps role values to Chinese display labels with styles
const roleLabels: Record<Role, { label: string; bg: string; color: string }> = {
  super_admin: { label: '超级管理员', bg: '#fde68a', color: '#78350f' },
  admin: { label: '管理员', bg: '#fef3c7', color: '#92400e' },
  user: { label: '普通用户', bg: '#f2f2f2', color: '#606060' },
}

// statusLabels maps status values to Chinese display labels with styles
const statusLabels: Record<UserStatus, { label: string; bg: string; color: string }> = {
  activated: { label: '已激活', bg: '#dcfce7', color: '#166534' },
  deactivated: { label: '已禁用', bg: '#fee2e2', color: '#991b1b' },
}

// Table cell styles (module-level for stable references across renders)
const tableBorder = '1px solid #e5e5e5'
const thStyle: React.CSSProperties = { background: '#f9f9f9', padding: '12px 16px', textAlign: 'left', color: '#606060', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: tableBorder }
const tdStyle: React.CSSProperties = { padding: '12px 16px', color: '#606060', whiteSpace: 'nowrap', borderTop: tableBorder }
const stickyTh: React.CSSProperties = { ...thStyle, position: 'sticky', left: 0, zIndex: 20, minWidth: 200, borderRight: tableBorder }
const stickyTd: React.CSSProperties = { ...tdStyle, position: 'sticky', left: 0, zIndex: 10, background: '#ffffff', borderRight: tableBorder }
const columnCount = 9

// LabeledSelect renders a select dropdown with colored label badges.
function LabeledSelect<T extends string>({ value, labels, onChange }: {
  value: T
  labels: Record<T, { label: string; bg: string; color: string }>
  onChange: (val: T) => void
}) {
  const current = labels[value]
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" className="w-24 border-0 bg-transparent shadow-none">
        <SelectValue>
          {current
            ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: current.bg, color: current.color }}>{current.label}</span>
            : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(labels) as [T, { label: string; bg: string; color: string }][]).map(([v, { label, bg, color }]) => (
          <SelectItem key={v} value={v}>
            <span className="px-2 py-0.5 rounded text-xs" style={{ background: bg, color }}>{label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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

const limit = 20

// AdminUsers displays the admin user management page with department sidebar and user list.
function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['admin-users', { search, departmentId }],
      queryFn: ({ pageParam }) =>
        listUsers({
          cursor: pageParam,
          limit,
          search: search || undefined,
          department_id: departmentId ? parseInt(departmentId, 10) : undefined,
        }),
      getNextPageParam: (lastPage) => lastPage.data.next_cursor || undefined,
      initialPageParam: undefined as string | undefined,
    })

  const users = data?.pages.flatMap((p) => p.data.items) ?? []
  const total = data?.pages[0]?.data.total ?? 0
  const observerRef = useRef<HTMLDivElement>(null)
  const handleIntersect = useCallback(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useIntersection(observerRef, handleIntersect)

  const loading = isLoading || isFetchingNextPage

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

  const handleFieldChange = async <K extends 'role' | 'status'>(userId: string, field: K, value: User[K]) => {
    try {
      await updateUser(userId, { [field]: value })
      // Note: useInfiniteQuery cache will be stale, but since we're not invalidating
      // it stays visually consistent until the next refetch
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Title */}
      <div className="flex items-center justify-between mb-4 shrink-0">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
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

      {/* Content area: sidebar + table, fills remaining height */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left sidebar - Department tree */}
        <div
          className="shrink-0 bg-white rounded-xl overflow-y-auto"
          style={{ width: 240, border: '1px solid #e5e5e5' }}
        >
          <DepartmentSidebar
            departments={departments}
            selectedId={departmentId}
            onSelect={(id) => updateFilters('department_id', id)}
          />
        </div>

        {/* Right side - Table with contained scroll */}
        <div className="flex-1 min-w-0 bg-white rounded-xl overflow-auto" style={{ border: tableBorder }}>
          <table style={{ minWidth: 1200, borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th style={stickyTh}>用户</th>
                <th style={thStyle}>邮箱</th>
                <th style={thStyle}>手机</th>
                <th style={thStyle}>部门</th>
                <th style={thStyle}>关注</th>
                <th style={thStyle}>角色</th>
                <th style={thStyle}>状态</th>
                <th style={thStyle}>注册时间</th>
                <th style={thStyle}>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading ? (
                <tr>
                  <td colSpan={columnCount} style={{ textAlign: 'center', padding: 32, color: '#909090' }}>
                    {hasFilters ? '未找到匹配的用户' : '暂无用户'}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td style={stickyTd}>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatar} alt={user.name || user.username} />
                          <AvatarFallback>{user.name?.charAt(0) || user.username.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <Link to={`/@${user.username}`} className="font-medium hover:underline" style={{ color: '#0f0f0f', whiteSpace: 'nowrap' }}>{user.name || user.username}</Link>
                          <span className="text-xs" style={{ color: '#909090' }}>@{user.username}</span>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{user.email || '-'}</td>
                    <td style={tdStyle}>{user.mobile || '-'}</td>
                    <td style={tdStyle}>
                      <span className="text-xs" style={{ background: '#f2f2f2', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                        {getDepartmentNames(user.department_ids)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs">{user.following_count} 关注</span>
                      <span className="mx-1" style={{ color: '#e5e5e5' }}>|</span>
                      <span className="text-xs">{user.follower_count} 粉丝</span>
                    </td>
                    <td style={tdStyle}>
                      <LabeledSelect value={user.role} labels={roleLabels} onChange={(val) => handleFieldChange(user.id, 'role', val)} />
                    </td>
                    <td style={tdStyle}>
                      <LabeledSelect value={user.status} labels={statusLabels} onChange={(val) => handleFieldChange(user.id, 'status', val)} />
                    </td>
                    <td style={tdStyle}>{dayjs(user.created_at).format('YYYY-MM-DD HH:mm')}</td>
                    <td style={tdStyle}>{dayjs(user.updated_at).format('YYYY-MM-DD HH:mm')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Loading indicator */}
          <div ref={observerRef} className="py-4 text-center">
            {loading && hasNextPage && (
              <div className="flex items-center justify-center gap-2" style={{ color: '#909090' }}>
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">加载更多...</span>
              </div>
            )}
            {!hasNextPage && users.length > 0 && (
              <span className="text-sm" style={{ color: '#909090' }}>已加载全部用户</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminUsers
