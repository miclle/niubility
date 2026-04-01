import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

import { updateUser } from 'src/api/user'
import type { User, Role, UserStatus, UpdateUserArgs } from 'src/types/user'

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

// UserEditForm represents the editable form state for a user.
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

// formatSocialAccounts converts social accounts record to key=value text format.
function formatSocialAccounts(socialAccounts?: Record<string, string>) {
  if (!socialAccounts || Object.keys(socialAccounts).length === 0) return ''
  return Object.entries(socialAccounts).map(([key, value]) => `${key}=${value}`).join('\n')
}

// parseSocialAccounts parses key=value text format into a record, with validation.
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

// UserEditModalProps defines the props for the UserEditModal component.
interface UserEditModalProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  getDepartmentNames: (deptIDs: string) => string
  onSaved: () => Promise<void>
}

// UserEditModal renders a dialog for editing user information.
function UserEditModal({ user, open, onOpenChange, getDepartmentNames, onSaved }: UserEditModalProps) {
  const [form, setForm] = useState<UserEditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Initialize form when dialog opens with a user
  useEffect(() => {
    if (!user || !open) return
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
  }, [user, open])

  const handleFormChange = <K extends keyof UserEditForm>(key: K, value: UserEditForm[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSaveUser = async () => {
    if (!user || !form) return

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
      await updateUser(user.id, payload)
      await onSaved()
      onOpenChange(false)
      setForm(null)
    } catch (error: any) {
      const message = error?.response?.data?.message || '保存失败，请稍后重试'
      setSaveError(typeof message === 'string' ? message : '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setForm(null)
      setSaveError('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>取消</Button>
          <Button onClick={handleSaveUser} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UserEditModal
