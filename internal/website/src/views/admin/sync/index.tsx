import { useState } from 'react'
import { Button } from '@radix-ui/themes'
import { RefreshCw, CheckCircle, XCircle, Loader2, Users } from 'lucide-react'

import { syncWechat } from 'src/api/user'

// AdminSync provides an interface for syncing all users from WeChat Work.
function AdminSync() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ synced: number; failed: number } | null>(null)
  const [error, setError] = useState('')

  const handleSync = async () => {
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await syncWechat()
      setResult(res.data)
    } catch (err) {
      setError('同步失败，请检查企业微信配置')
      console.error('Sync error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>企业微信同步</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Users size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>同步所有用户</h3>
        </div>

        <p className="text-sm mb-4" style={{ color: '#606060' }}>
          从企业微信同步所有用户的姓名、手机号和头像信息到系统。
        </p>

        {/* Result message */}
        {result && (
          <div className="mb-4 p-3 rounded-lg" style={{ background: result.failed > 0 ? '#fef3c7' : '#dcfce7' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} style={{ color: result.failed > 0 ? '#92400e' : '#166534' }} />
              <span className="text-sm font-medium" style={{ color: result.failed > 0 ? '#92400e' : '#166534' }}>
                同步完成
              </span>
            </div>
            <div className="text-sm ml-6" style={{ color: result.failed > 0 ? '#92400e' : '#166534' }}>
              成功: {result.synced} 个用户
              {result.failed > 0 && <span className="ml-2">失败: {result.failed} 个用户</span>}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
            <XCircle size={16} style={{ color: '#991b1b' }} />
            <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
          </div>
        )}

        {/* Sync button */}
        <Button
          size="2"
          disabled={loading}
          onClick={handleSync}
          style={{
            background: '#0f0f0f',
            color: '#ffffff',
            borderRadius: '18px',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              同步中...
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              同步所有用户
            </>
          )}
        </Button>
      </div>

      {/* Instructions */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}
      >
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>同步说明</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• 点击同步按钮将从企业微信获取所有用户的最新信息</li>
          <li>• 用户登录时也会自动同步其个人信息</li>
          <li>• 请确保已在「系统配置」中正确配置企业微信</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminSync
