import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { initSystem } from 'src/api/user'

// Init provides the initial super admin setup page.
function Init() {
  const { t } = useTranslation('auth')
  const { initialized, setCurrentUser } = useAppContext()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already initialized, redirect to home
  if (initialized) {
    return <Navigate to="/" replace />
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
      const res = await initSystem({
        username: form.username,
        email: form.email,
        password: form.password,
      })
      setCurrentUser(res.data)
      navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.meta || t('auth:initFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm" style={{ color: '#606060' }}>{t('auth:initWelcome')}</p>
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
            {loading ? <><Loader2 size={16} className="animate-spin" /> {t('auth:initializing')}</> : t('auth:completeInit')}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Init
