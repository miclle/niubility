import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, CheckCircle, XCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { useAppContext } from 'src/context/app'
import { changePassword, hasPassword } from 'src/api/user'

// SecuritySettings allows users to change their password.
function SecuritySettings() {
  const { registrationEnabled } = useAppContext()
  const [loading, setLoading] = useState(true)
  const [userHasPassword, setUserHasPassword] = useState(false)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const loadPasswordStatus = useCallback(async () => {
    try {
      const res = await hasPassword()
      setUserHasPassword(res.data.has_password)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPasswordStatus()
  }, [loadPasswordStatus])

  const handleSave = async () => {
    setError('')
    setSuccess(false)

    if (newPassword.length < 6) {
      setError('新密码长度不能少于 6 位')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (userHasPassword && !oldPassword) {
      setError('请输入旧密码')
      return
    }

    setSaving(true)
    try {
      await changePassword({ old_password: oldPassword, new_password: newPassword })
      setSuccess(true)
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setUserHasPassword(true)
    } catch (err: any) {
      const message = err?.response?.data?.message || '密码修改失败'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: '#909090' }} />
      </div>
    )
  }

  // Show password form if registration is enabled or user already has a password
  const showPasswordForm = registrationEnabled || userHasPassword

  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>安全设置</h1>

      <div className="space-y-8">
        {showPasswordForm ? (
          <div className="space-y-4">
            <h2 className="text-base font-medium" style={{ color: '#0f0f0f' }}>修改密码</h2>

            {userHasPassword ? (
              <div>
                <Label htmlFor="old-password" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>旧密码</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="输入当前密码"
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#f0f9ff' }}>
                <Info size={16} style={{ color: '#0369a1' }} />
                <span className="text-sm" style={{ color: '#0369a1' }}>
                  你当前通过 SSO 登录，尚未设置密码。设置密码后可使用用户名 + 密码登录。
                </span>
              </div>
            )}

            <div>
              <Label htmlFor="new-password" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
              />
            </div>

            <div>
              <Label htmlFor="confirm-password" className="text-sm mb-1.5 block" style={{ color: '#606060' }}>确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
              />
            </div>

            {/* Feedback */}
            {success && (
              <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#dcfce7' }}>
                <CheckCircle size={16} style={{ color: '#166534' }} />
                <span className="text-sm" style={{ color: '#166534' }}>密码修改成功</span>
              </div>
            )}
            {error && (
              <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
                <XCircle size={16} style={{ color: '#991b1b' }} />
                <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
              </div>
            )}

            <Button
              disabled={saving}
              onClick={handleSave}
              style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> 保存中...</>
              ) : (
                <><Save size={16} /> {userHasPassword ? '修改密码' : '设置密码'}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center py-16">
            <Info size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
            <p className="text-sm" style={{ color: '#909090' }}>
              你当前通过 SSO 登录，密码由身份提供商管理。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SecuritySettings
