import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { updateUser } from 'src/api/user'
import type { User, Role, UserStatus, UpdateUserArgs } from 'src/types/user'

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
function parseSocialAccounts(value: string): { ok: true; value: Record<string, string> } | { ok: false; code: 'invalid_format' } {
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean)
  const result: Record<string, string> = {}

  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (!key || rest.length === 0) {
      return { ok: false, code: 'invalid_format' }
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
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
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
      setSaveError(t('admin:usernameEmailRequired'))
      return
    }

    const socialAccounts = parseSocialAccounts(form.social_accounts)
    if (!socialAccounts.ok) {
      setSaveError(t('admin:socialAccountsFormatError'))
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
      const message = error?.response?.data?.message || tc('common:saveFailed')
      setSaveError(typeof message === 'string' ? message : tc('common:saveFailed'))
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
          <DialogTitle>{t('admin:editUserInfo')}</DialogTitle>
        </DialogHeader>

        {form && (
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:userName')}</label>
                <Input value={form.username} onChange={(e) => handleFormChange('username', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:fullName')}</label>
                <Input value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:emailAddress')}</label>
                <Input type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:mobilePhone')}</label>
                <Input value={form.mobile} onChange={(e) => handleFormChange('mobile', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:userRole')}</label>
                <Select value={form.role} onValueChange={(value) => handleFormChange('role', value as Role)}>
                  <SelectTrigger>
                    <SelectValue>
                      <span>{roleColors[form.role] ? t('admin:' + (form.role === 'super_admin' ? 'superAdmin' : form.role === 'admin' ? 'admin' : 'user')) : form.role}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">{t('admin:superAdmin')}</SelectItem>
                    <SelectItem value="admin">{t('admin:admin')}</SelectItem>
                    <SelectItem value="user">{t('admin:user')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:userStatus')}</label>
                <Select value={form.status} onValueChange={(value) => handleFormChange('status', value as UserStatus)}>
                  <SelectTrigger>
                    <SelectValue>
                      <span>{statusColors[form.status] ? t('admin:' + (form.status === 'activated' ? 'activated' : 'deactivated')) : form.status}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activated">{t('admin:activated')}</SelectItem>
                    <SelectItem value="deactivated">{t('admin:deactivated')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:userDepartment')}</label>
                <Input value={form.department_ids} onChange={(e) => handleFormChange('department_ids', e.target.value)} placeholder={t('admin:departmentHint')} />
                <div className="app-text-tertiary text-xs">
                  {getDepartmentNames(form.department_ids)}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">{t('admin:resetPassword')}</label>
                <Input type="password" value={form.password} onChange={(e) => handleFormChange('password', e.target.value)} placeholder={t('admin:resetPasswordHint')} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('admin:avatarURL')}</label>
              <Input value={form.avatar} onChange={(e) => handleFormChange('avatar', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('admin:userLocation')}</label>
              <Input value={form.location} onChange={(e) => handleFormChange('location', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('admin:userBio')}</label>
              <Textarea rows={3} value={form.bio} onChange={(e) => handleFormChange('bio', e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">{t('admin:socialAccountsLabel')}</label>
              <Textarea
                rows={4}
                value={form.social_accounts}
                onChange={(e) => handleFormChange('social_accounts', e.target.value)}
                placeholder={t('admin:socialAccountsPlaceholder')}
              />
            </div>

            {saveError && (
              <div className="text-sm text-red-600 dark:text-red-400">{saveError}</div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{tc('common:cancel')}</Button>
          <Button onClick={handleSaveUser} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {t('admin:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default UserEditModal
