import { useState } from 'react'
import { Button, Avatar } from '@radix-ui/themes'
import { RefreshCw, CheckCircle, XCircle, Loader2, User } from 'lucide-react'

import { syncWechat } from 'src/api/user'
import { useAppContext } from 'src/context/app'
import type { User as UserType } from 'src/types/user'

// AdminSync provides an interface for syncing user info from WeChat Work.
function AdminSync() {
  const { currentUser, setCurrentUser } = useAppContext()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [syncedUser, setSyncedUser] = useState<UserType | null>(null)

  const handleSync = async () => {
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const res = await syncWechat()
      setSyncedUser(res.data)
      setCurrentUser(res.data)
      setSuccess(true)
    } catch (err) {
      setError('同步失败，请稍后重试')
      console.error('Sync error:', err)
    } finally {
      setLoading(false)
    }
  }

  const displayUser = syncedUser || currentUser

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>企业微信同步</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <h3 className="text-sm font-medium mb-4" style={{ color: '#606060' }}>当前用户信息</h3>

        {/* User info card */}
        <div
          className="flex items-center gap-4 p-4 rounded-xl mb-4"
          style={{ background: '#f9f9f9' }}
        >
          <Avatar
            size="5"
            radius="full"
            src={displayUser?.avatar}
            fallback={displayUser?.name?.charAt(0) || displayUser?.username?.charAt(0) || 'U'}
            style={{ width: 64, height: 64 }}
          />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <User size={16} style={{ color: '#909090' }} />
              <span className="font-medium" style={{ color: '#0f0f0f' }}>
                {displayUser?.name || '未设置'}
              </span>
            </div>
            <div className="text-sm" style={{ color: '#606060' }}>
              用户名: {displayUser?.username}
            </div>
            <div className="text-sm" style={{ color: '#606060' }}>
              邮箱: {displayUser?.email || '未设置'}
            </div>
            <div className="text-sm" style={{ color: '#606060' }}>
              手机: {displayUser?.mobile || '未设置'}
            </div>
          </div>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#dcfce7' }}>
            <CheckCircle size={16} style={{ color: '#166534' }} />
            <span className="text-sm" style={{ color: '#166534' }}>同步成功，已从企业微信更新用户信息</span>
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
              同步企业微信信息
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
          <li>• 点击同步按钮将从企业微信获取最新的用户姓名和头像</li>
          <li>• 如果企业微信中的信息有更新，同步后会自动更新本地数据</li>
          <li>• 登录时会自动同步一次，如需手动更新可使用此功能</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminSync
