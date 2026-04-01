import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Loader2, X, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import { useIntersection } from 'src/hooks/use-intersection'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import DepartmentFilter from './DepartmentFilter'
import UserEditModal from './UserEditModal'
import LabeledSelect from './LabeledSelect'
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
const columnCount = 10

const limit = 20

// AdminUsers displays the admin user management page with department sidebar and user list.
function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

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

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
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
      await refetch()
    } catch {
      // Silently fail
    }
  }

  const openEditDialog = (user: User) => {
    setEditingUser(user)
    setDialogOpen(true)
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Title */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>用户管理</h1>
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

        <DepartmentFilter
          departments={departments}
          selectedId={departmentId}
          onSelect={(id) => updateFilters('department_id', id)}
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

      {/* Table */}
      <div className="flex-1 min-h-0 min-w-0 bg-white rounded-xl overflow-auto" style={{ border: tableBorder }}>
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
                <th style={thStyle}>操作</th>
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
                          <SiteAvatarImage src={user.avatar} alt={user.name || user.username} />
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
                    <td style={tdStyle}>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} style={{ color: '#606060' }}>
                        <Pencil size={14} />
                        编辑
                      </Button>
                    </td>
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

      <UserEditModal
        user={editingUser}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingUser(null)
        }}
        getDepartmentNames={getDepartmentNames}
        onSaved={refetch}
      />
    </div>
  )
}

export default AdminUsers
