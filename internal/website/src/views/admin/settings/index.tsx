import { useState, useEffect } from 'react'
import { Button, TextField } from '@radix-ui/themes'
import { Settings, CheckCircle, XCircle, Loader2, Save } from 'lucide-react'

import { listSettings, updateSettings } from 'src/api/setting'
import type { WechatSettings } from 'src/types/setting'

// AdminSettings provides an interface for managing system settings.
function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [wechatForm, setWechatForm] = useState<WechatSettings>({
    corp_id: '',
    app_agentid: '',
    app_secret: '',
  })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await listSettings()
      // Parse settings into form
      const form: WechatSettings = { corp_id: '', app_agentid: '', app_secret: '' }
      for (const s of res.data.settings) {
        if (s.key === 'wechat.corp_id') form.corp_id = s.value
        if (s.key === 'wechat.app_agentid') form.app_agentid = s.value
        if (s.key === 'wechat.app_secret') form.app_secret = s.value
      }
      setWechatForm(form)
    } catch (err) {
      console.error('Load settings error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      await updateSettings({
        settings: {
          'wechat.corp_id': wechatForm.corp_id,
          'wechat.app_agentid': wechatForm.app_agentid,
          'wechat.app_secret': wechatForm.app_secret,
        },
      })
      setSuccess(true)
      loadSettings()
    } catch (err) {
      setError('保存失败，请稍后重试')
      console.error('Save settings error:', err)
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

  return (
    <div>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>系统配置</h1>

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>企业微信配置</h3>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#dcfce7' }}>
            <CheckCircle size={16} style={{ color: '#166534' }} />
            <span className="text-sm" style={{ color: '#166534' }}>配置已保存，企业微信客户端已刷新</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
            <XCircle size={16} style={{ color: '#991b1b' }} />
            <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              企业 ID (CorpID)
            </label>
            <TextField.Root
              placeholder="请输入企业 ID"
              value={wechatForm.corp_id}
              onChange={(e) => setWechatForm({ ...wechatForm, corp_id: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              应用 AgentID
            </label>
            <TextField.Root
              placeholder="请输入应用 AgentID"
              value={wechatForm.app_agentid}
              onChange={(e) => setWechatForm({ ...wechatForm, app_agentid: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              应用 Secret
            </label>
            <TextField.Root
              type="password"
              placeholder="请输入应用 Secret"
              value={wechatForm.app_secret}
              onChange={(e) => setWechatForm({ ...wechatForm, app_secret: e.target.value })}
            />
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6">
          <Button
            size="2"
            disabled={saving}
            onClick={handleSave}
            style={{
              background: '#0f0f0f',
              color: '#ffffff',
              borderRadius: '18px',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save size={16} />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Instructions */}
      <div
        className="mt-6 p-4 rounded-xl"
        style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}
      >
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>配置说明</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• 企业微信配置保存在数据库中，保存后立即生效，无需重启服务</li>
          <li>• 企业 ID 和应用信息可在企业微信管理后台获取</li>
          <li>• 配置完成后可前往「微信同步」页面测试同步功能</li>
        </ul>
      </div>
    </div>
  )
}

export default AdminSettings
