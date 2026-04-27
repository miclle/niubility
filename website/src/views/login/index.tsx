import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ServerOff } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { useSiteHead } from 'src/hooks/useSiteHead'
import { siteResourceURL } from 'src/api/upload'
import { login } from 'src/api/user'
import ThemeDropdown from 'src/components/ThemeDropdown'

// Login provides the username+password login page.
function Login() {
  const { t } = useTranslation('auth')
  const { initialized, currentUser, registrationEnabled, ssoEnabled, ssoLoginUrl, siteConfig, setCurrentUser } = useAppContext()
  const navigate = useNavigate()

  // Apply site config to document head
  useSiteHead(siteConfig)

  // Derived values from site config
  const siteTitle = siteConfig?.title || 'Niubility'
  const siteLogoUrl = siteConfig?.logo_url ? siteResourceURL(siteConfig.logo_url) : null

  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If not initialized, show prompt instead of login form
  if (!initialized) {
    return (
      <div className="app-surface min-h-screen flex items-center justify-center px-4">
        <div className="app-panel text-center px-8 py-10 rounded-2xl">
          <div className="app-surface-muted inline-flex items-center justify-center w-14 h-14 rounded-full mb-5">
            <ServerOff size={28} className="app-text-tertiary" />
          </div>
          <h1 className="text-2xl font-semibold mb-2 text-foreground">{siteTitle}</h1>
          <p className="app-text-secondary text-sm mb-1">{t('auth:notInitialized')}</p>
          <p className="app-text-tertiary text-xs">{t('auth:contactAdmin')}</p>
        </div>
      </div>
    )
  }

  // If already logged in, redirect to home
  if (currentUser) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await login({ username: form.username, password: form.password })
      setCurrentUser(res.data.user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.meta || t('auth:loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-surface relative min-h-screen flex items-center justify-center px-4" data-testid="login-page">
      <div className="absolute right-4 top-4">
        <ThemeDropdown variant="outline" />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {siteLogoUrl ? (
            <img src={siteLogoUrl} alt={siteTitle} className="h-10 mx-auto mb-3 object-contain" />
          ) : (
            <h1 className="text-2xl font-semibold mb-2 text-foreground">{siteTitle}</h1>
          )}
          <p className="app-text-secondary text-sm">{t('auth:loginToAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
          {error && (
            <div className="theme-danger-banner p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('auth:username')}</label>
            <Input
              required
              placeholder={t('auth:usernamePlaceholder')}
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('auth:password')}</label>
            <Input
              required
              type="password"
              placeholder={t('auth:passwordPlaceholder')}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="theme-primary-button w-full rounded-[18px]"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> {t('auth:loggingIn')}</> : t('auth:login')}
          </Button>
        </form>

        {/* SSO login */}
        {ssoEnabled && ssoLoginUrl && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-[var(--surface-border)]" />
              <span className="app-text-tertiary text-xs">{t('auth:or')}</span>
              <div className="flex-1 h-px bg-[var(--surface-border)]" />
            </div>
            <a
              href={ssoLoginUrl}
              className="app-surface-elevated flex items-center justify-center w-full py-2 rounded-full text-sm font-medium no-underline transition-colors border app-border text-foreground hover:bg-[var(--surface-hover)]"
            >
              {t('auth:ssoLogin')}
            </a>
          </div>
        )}

        {/* Registration link */}
        {registrationEnabled && (
          <p className="app-text-secondary mt-6 text-center text-sm">
            {t('auth:noAccount')}{' '}
            <Link to="/register" className="app-link font-medium">{t('auth:register')}</Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default Login
