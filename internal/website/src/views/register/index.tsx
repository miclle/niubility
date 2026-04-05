import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { useSiteHead } from 'src/hooks/useSiteHead'
import { siteResourceURL } from 'src/api/upload'
import { register } from 'src/api/user'

// Register provides the user self-registration page.
function Register() {
  const { t } = useTranslation('auth')
  const { initialized, currentUser, registrationEnabled, siteConfig } = useAppContext()

  // Apply site config to document head
  useSiteHead(siteConfig)

  // Derived values from site config
  const siteTitle = siteConfig?.title || 'Niubility'
  const siteLogoUrl = siteConfig?.logo_url ? siteResourceURL(siteConfig.logo_url) : null

  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // If not initialized, redirect to init page
  if (!initialized) {
    return <Navigate to="/init" replace />
  }

  // If already logged in, redirect to home
  if (currentUser) {
    return <Navigate to="/" replace />
  }

  // If registration is not enabled, redirect to login
  if (!registrationEnabled) {
    return <Navigate to="/login" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError(t('auth:passwordMismatch'))
      return
    }

    if (form.password.length < 6) {
      setError(t('auth:passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.meta || t('auth:registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#166534' }} />
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>{t('auth:registerSuccess')}</h2>
          <p className="text-sm mb-6" style={{ color: '#606060' }}>
            {t('auth:registerSuccessDescription')}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center px-6 py-2 rounded-full text-sm font-medium no-underline"
            style={{ background: '#0f0f0f', color: '#ffffff' }}
          >
            {t('auth:backToLogin')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {siteLogoUrl ? (
            <img src={siteLogoUrl} alt={siteTitle} className="h-10 mx-auto mb-3 object-contain" />
          ) : (
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>{siteTitle}</h1>
          )}
          <p className="text-sm" style={{ color: '#606060' }}>{t('auth:createAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('auth:username')}</label>
            <Input
              required
              placeholder={t('auth:usernamePlaceholder')}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('auth:email')}</label>
            <Input
              required
              type="email"
              placeholder={t('auth:emailPlaceholder')}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('auth:password')}</label>
            <Input
              required
              type="password"
              placeholder={t('auth:initPasswordHint')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('auth:confirmPassword')}</label>
            <Input
              required
              type="password"
              placeholder={t('auth:confirmPasswordPlaceholder')}
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> {t('auth:registering')}</> : t('auth:register')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: '#606060' }}>
          {t('auth:hasAccount')}{' '}
          <Link to="/login" className="font-medium" style={{ color: '#065fd4' }}>{t('auth:login')}</Link>
        </p>
      </div>
    </div>
  )
}

export default Register
