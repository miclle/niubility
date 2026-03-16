import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { login } from 'src/api/user'

// Login provides the username+password login page.
function Login() {
  const { initialized, currentUser, registrationEnabled, ssoEnabled, ssoLoginUrl, setCurrentUser } = useAppContext()
  const navigate = useNavigate()

  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If not initialized, show prompt instead of login form
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm" style={{ color: '#606060' }}>系统尚未初始化，请联系管理员完成初始设置</p>
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
      setError(err.response?.data?.meta || '登录失败，请检查用户名和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm" style={{ color: '#606060' }}>登录你的账户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>用户名</label>
            <Input
              required
              placeholder="请输入用户名"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>密码</label>
            <Input
              required
              type="password"
              placeholder="请输入密码"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full"
            style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> 登录中...</> : '登录'}
          </Button>
        </form>

        {/* SSO login */}
        {ssoEnabled && ssoLoginUrl && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: '#e5e5e5' }} />
              <span className="text-xs" style={{ color: '#909090' }}>或</span>
              <div className="flex-1 h-px" style={{ background: '#e5e5e5' }} />
            </div>
            <a
              href={ssoLoginUrl}
              className="flex items-center justify-center w-full py-2 rounded-full text-sm font-medium no-underline transition-colors"
              style={{ border: '1px solid #e5e5e5', color: '#0f0f0f' }}
            >
              SSO 登录
            </a>
          </div>
        )}

        {/* Registration link */}
        {registrationEnabled && (
          <p className="mt-6 text-center text-sm" style={{ color: '#606060' }}>
            还没有账户？{' '}
            <Link to="/register" className="font-medium" style={{ color: '#065fd4' }}>注册</Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default Login
