import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Loader2, X, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import { useIntersection } from 'src/hooks/use-intersection'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import DepartmentFilter from './DepartmentFilter'
import UserEditModal from './UserEditModal'
import LabeledSelect from './LabeledSelect'
import type { User, Role, UserStatus, Department } from 'src/types/user'

// roleColors maps role values to background/text colors only (labels are translated inline)
const roleColors: Record<Role, { bg: string; color: string }> = {
  super_admin: { bg: '#fde68a', color: '#78350f' },
  admin: { bg: '#fef3c7', color: '#92400e' },
  user: { bg: '#f2f2f2', color: '#606060' },
}

// statusColors maps status values to background/text colors only (labels are translated inline)
const statusColors: Record<UserStatus, { bg: string; color: string }> = {
  activated: { bg: '#dcfce7', color: '#166534' },
  deactivated: { bg: '#fee2e2', color: '#991b1b' },
}

// Table cell styles (module-level for stable references across renders)
const tableBorder = '1px solid var(--surface-border)'
const thStyle: React.CSSProperties = { background: 'var(--surface-muted)', padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, whiteSpace: 'nowrap', borderBottom: tableBorder }
const tdStyle: React.CSSProperties = { padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderTop: tableBorder }
const stickyTh: React.CSSProperties = { ...thStyle, position: 'sticky', left: 0, zIndex: 20, minWidth: 200, borderRight: tableBorder }
const stickyTd: React.CSSProperties = { ...tdStyle, position: 'sticky', left: 0, zIndex: 10, background: 'var(--surface-elevated)', borderRight: tableBorder }
const columnCount = 10

const limit = 20

// AdminUsers displays the admin user management page with department sidebar and user list.
function AdminUsers() {
  const { t } = useTranslation('admin')
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
    <div className="app-surface flex flex-col flex-1 min-h-0">
      {/* Title */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-xl font-semibold text-foreground">{t('admin:userManagement')}</h1>
        <div className="app-text-secondary text-sm">
          {t('admin:userCount', { count: total })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div className="relative" style={{ minWidth: 280 }}>
          <Search size={16} className="app-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder={t('admin:searchPlaceholder')}
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
            className="app-surface-muted flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={14} />
            {t('admin:clearFilters')}
          </button>
        )}

        {loading && (
          <Loader2 size={16} className="app-text-tertiary animate-spin" />
        )}
      </div>

      {/* Table */}
      <div className="app-surface-elevated flex-1 min-h-0 min-w-0 rounded-xl overflow-auto" style={{ border: tableBorder }}>
          <table style={{ minWidth: 1200, borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead className="sticky top-0 z-20">
              <tr>
                <th style={stickyTh}>{t('admin:users')}</th>
                <th style={thStyle}>{t('admin:emailAddress')}</th>
                <th style={thStyle}>{t('admin:mobilePhone')}</th>
                <th style={thStyle}>{t('admin:department')}</th>
                <th style={thStyle}>{t('admin:followCount')} / {t('admin:fansCount')}</th>
                <th style={thStyle}>{t('admin:role')}</th>
                <th style={thStyle}>{t('admin:status')}</th>
                <th style={thStyle}>{t('admin:createdAt')}</th>
                <th style={thStyle}>{t('admin:updatedAt')}</th>
                <th style={thStyle}>{t('admin:actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading ? (
                <tr>
                  <td colSpan={columnCount} style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)' }}>
                    {hasFilters ? t('admin:noUsersMatch') : t('admin:noUsersFound')}
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
                          <Link to={`/@${user.username}`} className="font-medium hover:underline" style={{ color: 'var(--foreground)', whiteSpace: 'nowrap' }}>{user.name || user.username}</Link>
                          <span className="app-text-tertiary text-xs">@{user.username}</span>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{user.email || '-'}</td>
                    <td style={tdStyle}>{user.mobile || '-'}</td>
                    <td style={tdStyle}>
                      <span className="app-surface-muted text-xs" style={{ padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                        {getDepartmentNames(user.department_ids)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span className="text-xs">{user.following_count} {t('admin:followCount')}</span>
                      <span className="mx-1" style={{ color: 'var(--surface-border)' }}>|</span>
                      <span className="text-xs">{user.follower_count} {t('admin:fansCount')}</span>
                    </td>
                    <td style={tdStyle}>
                      <LabeledSelect value={user.role} colors={roleColors} labelKey={(v) => t('admin:' + (v === 'super_admin' ? 'superAdmin' : v === 'admin' ? 'admin' : 'user'))} onChange={(val) => handleFieldChange(user.id, 'role', val)} />
                    </td>
                    <td style={tdStyle}>
                      <LabeledSelect value={user.status} colors={statusColors} labelKey={(v) => t('admin:' + (v === 'activated' ? 'activated' : 'deactivated'))} onChange={(val) => handleFieldChange(user.id, 'status', val)} />
                    </td>
                    <td style={tdStyle}>{dayjs(user.created_at).format('YYYY-MM-DD HH:mm')}</td>
                    <td style={tdStyle}>{dayjs(user.updated_at).format('YYYY-MM-DD HH:mm')}</td>
                    <td style={tdStyle}>
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)} style={{ color: 'var(--text-secondary)' }}>
                        <Pencil size={14} />
                        {t('admin:edit')}
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
              <div className="app-text-tertiary flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">{t('admin:loadingMore')}</span>
              </div>
            )}
            {!hasNextPage && users.length > 0 && (
              <span className="app-text-tertiary text-sm">{t('admin:allUsersLoaded')}</span>
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
        onSaved={async () => { await refetch() }}
      />
    </div>
  )
}

export default AdminUsers
