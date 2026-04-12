import { useState, useEffect, useCallback } from 'react'
import { Loader2, Save, CheckCircle, XCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { changePassword, hasPassword } from 'src/api/user'

// SecuritySettings allows users to change their password.
function SecuritySettings() {
  const { t } = useTranslation('settings')
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
      setError(t('settings:passwordMinLength'))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t('settings:passwordMismatch'))
      return
    }

    if (userHasPassword && !oldPassword) {
      setError(t('settings:enterOldPassword'))
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
      const message = err?.response?.data?.message || t('settings:passwordChangeFailed')
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="app-text-tertiary animate-spin" />
      </div>
    )
  }

  // Show password form if registration is enabled or user already has a password
  const showPasswordForm = registrationEnabled || userHasPassword

  return (
    <div className="app-surface min-h-full">
      <div className="border-b app-border px-6 py-8 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">{t('settings:securitySettings')}</h1>
      </div>

      <div className="max-w-[720px] space-y-8 px-6 py-8 lg:px-12">
        {showPasswordForm ? (
          <div className="space-y-4">
            <h2 className="text-base font-medium text-foreground">{t('settings:changePassword')}</h2>

            {userHasPassword ? (
              <div>
                <Label htmlFor="old-password" className="app-text-secondary text-sm mb-1.5 block">{t('settings:oldPassword')}</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder={t('settings:enterCurrentPassword')}
                />
              </div>
            ) : (
              <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)' }}>
                <Info size={16} style={{ color: '#0369a1' }} />
                <span className="text-sm" style={{ color: '#0369a1' }}>
                  {t('settings:ssoLoginNote')}
                </span>
              </div>
            )}

            <div>
              <Label htmlFor="new-password" className="app-text-secondary text-sm mb-1.5 block">{t('settings:newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('settings:minChars')}
              />
            </div>

            <div>
              <Label htmlFor="confirm-password" className="app-text-secondary text-sm mb-1.5 block">{t('settings:confirmNewPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('settings:enterNewPasswordAgain')}
              />
            </div>

            {/* Feedback */}
            {success && (
              <div className="theme-success-banner p-3 rounded-lg flex items-center gap-2">
                <CheckCircle size={16} />
                <span className="text-sm">{t('settings:passwordChangeSuccess')}</span>
              </div>
            )}
            {error && (
              <div className="theme-danger-banner p-3 rounded-lg flex items-center gap-2">
                <XCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <Button
              disabled={saving}
              onClick={handleSave}
              className="theme-primary-button rounded-[18px]"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> {t('settings:savingPassword')}</>
              ) : (
                <><Save size={16} /> {userHasPassword ? t('settings:changePassword') : t('settings:setPassword')}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="text-center py-16">
            <Info size={48} className="app-text-tertiary mx-auto mb-4" />
            <p className="app-text-tertiary text-sm">
              {t('settings:ssoPasswordManaged')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SecuritySettings
