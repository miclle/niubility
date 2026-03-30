import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Search, Loader2, X, Building2, ChevronRight, ChevronDown, Pencil } from 'lucide-react'
import dayjs from 'dayjs'
import { useInfiniteQuery } from '@tanstack/react-query'

import { listUsers, updateUser, listDepartments } from 'src/api/user'
import { useIntersection } from 'src/hooks/use-intersection'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { User, Role, UserStatus, Department, UpdateUserArgs } from 'src/types/user'

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

type UserEditForm = {
  username: string
  email: string
  name: string
  mobile: string
  avatar: string
  bio: string
  location: string
  department_ids: string
  role: Role
  status: UserStatus
  password: string
  social_accounts: string
}

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

// DepartmentFilter renders a searchable dropdown with collapsible tree for departments
function DepartmentFilter({
  departments,
  selectedId,
  onSelect,
}: {
  departments: Department[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const tree = buildDepartmentTree(departments, 0)
  const selectedDept = departments.find(d => String(d.id) === selectedId)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    setOpen(false)
  }

  // Flat filtered list for search mode
  const filteredDepts = query.trim()
    ? departments.filter(d => d.name.toLowerCase().includes(query.trim().toLowerCase()) || d.name_en?.toLowerCase().includes(query.trim().toLowerCase()))
    : null

  const renderNode = (node: DepartmentNode, level: number = 0): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const isSelected = String(node.id) === selectedId

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors hover:bg-accent"
          style={{ paddingLeft: level * 16 + 8, background: isSelected ? 'var(--color-accent)' : undefined }}
          onClick={() => handleSelect(String(node.id))}
        >
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center shrink-0" onClick={(e) => toggleExpand(node.id, e)}>
              <ChevronRight size={12} className="transition-transform" style={{ color: '#909090', transform: isExpanded ? 'rotate(90deg)' : undefined }} />
            </span>
          ) : (
            <span className="w-4" />
          )}
          <span className="text-sm flex-1 truncate" style={{ color: isSelected ? '#0f0f0f' : '#606060', fontWeight: isSelected ? 500 : 400 }}>{node.name}</span>
          <span className="text-xs tabular-nums" style={{ color: '#909090' }}>{node.user_count || 0}</span>
        </div>
        {hasChildren && isExpanded && node.children?.map(child => renderNode(child, level + 1))}
      </div>
    )
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-input bg-transparent px-3 h-8 text-sm whitespace-nowrap transition-colors hover:bg-accent/50"
      >
        <Building2 size={14} style={{ color: '#606060' }} />
        <span style={{ color: selectedDept ? '#0f0f0f' : '#606060' }}>{selectedDept ? selectedDept.name : '全部部门'}</span>
        <ChevronDown size={14} style={{ color: '#909090' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-72 rounded-lg bg-popover shadow-md ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          {/* Search input */}
          <div className="p-2" style={{ borderBottom: '1px solid #e5e5e5' }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#909090' }} />
              <input
                ref={inputRef}
                type="text"
                placeholder="搜索部门..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full h-8 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/50"
              />
            </div>
          </div>
          {/* Options */}
          <div className="max-h-64 overflow-y-auto py-1 px-1">
            {filteredDepts ? (
              // Search mode: flat list
              filteredDepts.length === 0 ? (
                <div className="py-4 text-center text-sm" style={{ color: '#909090' }}>无匹配部门</div>
              ) : (
                filteredDepts.map(dept => {
                  const isSelected = String(dept.id) === selectedId
                  return (
                    <div
                      key={dept.id}
                      className="flex items-center gap-1.5 py-1.5 px-3 cursor-pointer rounded transition-colors hover:bg-accent"
                      style={{ background: isSelected ? 'var(--color-accent)' : undefined }}
                      onClick={() => handleSelect(String(dept.id))}
                    >
                      <span className="text-sm flex-1 truncate" style={{ color: isSelected ? '#0f0f0f' : '#606060', fontWeight: isSelected ? 500 : 400 }}>{dept.name}</span>
                      <span className="text-xs tabular-nums" style={{ color: '#909090' }}>{dept.user_count || 0}</span>
                    </div>
                  )
                })
              )
            ) : (
              // Tree mode
              <>
                <div
                  className="flex items-center gap-1.5 py-1.5 px-2 cursor-pointer rounded transition-colors hover:bg-accent"
                  style={{ background: !selectedId ? 'var(--color-accent)' : undefined }}
                  onClick={() => handleSelect('')}
                >
                  <span className="w-4" />
                  <span className="text-sm flex-1" style={{ color: !selectedId ? '#0f0f0f' : '#606060', fontWeight: !selectedId ? 500 : 400 }}>全部部门</span>
                </div>
                {tree.map(node => renderNode(node))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const limit = 20

// AdminUsers displays the admin user management page with department sidebar and user list.
function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptMap, setDeptMap] = useState<Map<number, string>>(new Map())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserEditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

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
    setForm({
      username: user.username || '',
      email: user.email || '',
      name: user.name || '',
      mobile: user.mobile || '',
      avatar: user.avatar || '',
      bio: user.bio || '',
      location: user.location || '',
      department_ids: user.department_ids || '',
      role: user.role,
      status: user.status,
      password: '',
      social_accounts: formatSocialAccounts(user.social_accounts),
    })
    setSaveError('')
    setDialogOpen(true)
  }

  const handleFormChange = <K extends keyof UserEditForm>(key: K, value: UserEditForm[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSaveUser = async () => {
    if (!editingUser || !form) return

    if (!form.username.trim() || !form.email.trim()) {
      setSaveError('用户名和邮箱不能为空')
      return
    }

    const socialAccounts = parseSocialAccounts(form.social_accounts)
    if (!socialAccounts.ok) {
      setSaveError(socialAccounts.message)
      return
    }

    const payload: UpdateUserArgs = {
      username: form.username.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      mobile: form.mobile.trim(),
      avatar: form.avatar.trim(),
      bio: form.bio.trim(),
      location: form.location.trim(),
      department_ids: form.department_ids.trim(),
      role: form.role,
      status: form.status,
      social_accounts: socialAccounts.value,
    }
    if (form.password) {
      payload.password = form.password
    }

    setSaving(true)
    setSaveError('')
    try {
      await updateUser(editingUser.id, payload)
      await refetch()
      setDialogOpen(false)
      setEditingUser(null)
      setForm(null)
    } catch (error: any) {
      const message = error?.response?.data?.message || '保存失败，请稍后重试'
      setSaveError(typeof message === 'string' ? message : '保存失败，请稍后重试')
    } finally {
      setSaving(false)
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

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditingUser(null)
          setForm(null)
          setSaveError('')
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑用户信息</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>用户名</label>
                  <Input value={form.username} onChange={(e) => handleFormChange('username', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>姓名</label>
                  <Input value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>邮箱</label>
                  <Input type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>手机</label>
                  <Input value={form.mobile} onChange={(e) => handleFormChange('mobile', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>角色</label>
                  <Select value={form.role} onValueChange={(value) => handleFormChange('role', value as Role)}>
                    <SelectTrigger>
                      <SelectValue>
                        <span>{roleLabels[form.role].label}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">超级管理员</SelectItem>
                      <SelectItem value="admin">管理员</SelectItem>
                      <SelectItem value="user">普通用户</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>状态</label>
                  <Select value={form.status} onValueChange={(value) => handleFormChange('status', value as UserStatus)}>
                    <SelectTrigger>
                      <SelectValue>
                        <span>{statusLabels[form.status].label}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="activated">已激活</SelectItem>
                      <SelectItem value="deactivated">已禁用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>部门</label>
                  <Input value={form.department_ids} onChange={(e) => handleFormChange('department_ids', e.target.value)} placeholder="如 1,2,3" />
                  <div className="text-xs" style={{ color: '#909090' }}>
                    {getDepartmentNames(form.department_ids)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>重置密码</label>
                  <Input type="password" value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} placeholder="留空则不修改" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>头像地址</label>
                <Input value={form.avatar} onChange={(e) => handleFormChange('avatar', e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>所在地</label>
                <Input value={form.location} onChange={(e) => handleFormChange('location', e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>简介</label>
                <Textarea rows={3} value={form.bio} onChange={(e) => handleFormChange('bio', e.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" style={{ color: '#0f0f0f' }}>社交账号</label>
                <Textarea
                  rows={4}
                  value={form.social_accounts}
                  onChange={(e) => handleFormChange('social_accounts', e.target.value)}
                  placeholder={'每行一个，格式为 key=value\n例如 github=alice'}
                />
              </div>

              {saveError && (
                <div className="text-sm" style={{ color: '#cc0000' }}>{saveError}</div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatSocialAccounts(socialAccounts?: Record<string, string>) {
  if (!socialAccounts || Object.keys(socialAccounts).length === 0) return ''
  return Object.entries(socialAccounts).map(([key, value]) => `${key}=${value}`).join('\n')
}

function parseSocialAccounts(value: string): { ok: true; value: Record<string, string> } | { ok: false; message: string } {
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean)
  const result: Record<string, string> = {}

  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (!key || rest.length === 0) {
      return { ok: false, message: '社交账号格式不正确，请使用每行 key=value' }
    }
    result[key.trim()] = rest.join('=').trim()
  }

  return { ok: true, value: result }
}

export default AdminUsers
