import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { initSystem } from 'src/api/user'

// Init provides the initial super admin setup page.
function Init() {
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
      setError('两次输入的密码不一致')
      return
    }

    if (form.password.length < 6) {
      setError('密码至少需要 6 个字符')
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
      setError(err.response?.data?.meta || '初始化失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm" style={{ color: '#606060' }}>欢迎使用，请设置超级管理员账户</p>
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
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>邮箱</label>
            <Input
              required
              type="email"
              placeholder="请输入邮箱"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>密码</label>
            <Input
              required
              type="password"
              placeholder="请输入密码（至少 6 位）"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>确认密码</label>
            <Input
              required
              type="password"
              placeholder="请再次输入密码"
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
            {loading ? <><Loader2 size={16} className="animate-spin" /> 初始化中...</> : '完成初始化'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Init
