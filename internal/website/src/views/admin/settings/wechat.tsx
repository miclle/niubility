import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Settings, Shield } from 'lucide-react'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SettingsWechat provides the WeChat Work settings page.
function SettingsWechat() {
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  const [hasExistingWechatSecret, setHasExistingWechatSecret] = useState(false)
  const [wechatForm, setWechatForm] = useState({ corp_id: '', app_agentid: '', app_secret: '' })

  useEffect(() => {
    if (loading) return
    const wechat = {
      corp_id: settingsMap['wechat.corp_id'] || '',
      app_agentid: settingsMap['wechat.app_agentid'] || '',
      app_secret: '',
    }
    if (settingsMap['wechat.app_secret'] === MASKED_VALUE) {
      setHasExistingWechatSecret(true)
    } else {
      wechat.app_secret = settingsMap['wechat.app_secret'] || ''
    }
    setWechatForm(wechat)
  }, [loading, settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      'wechat.corp_id': wechatForm.corp_id,
      'wechat.app_agentid': wechatForm.app_agentid,
    }
    if (wechatForm.app_secret || !hasExistingWechatSecret) {
      settings['wechat.app_secret'] = wechatForm.app_secret
    }
    save(settings)
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>企业微信配置</h1>

      <SettingsFeedback success={success} error={error} />

      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>企业微信配置</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>企业 ID (CorpID)</label>
            <Input
              placeholder="请输入企业 ID"
              value={wechatForm.corp_id}
              onChange={(e) => setWechatForm({ ...wechatForm, corp_id: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>应用 AgentID</label>
            <Input
              placeholder="请输入应用 AgentID"
              value={wechatForm.app_agentid}
              onChange={(e) => setWechatForm({ ...wechatForm, app_agentid: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              应用 Secret
              {hasExistingWechatSecret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingWechatSecret ? '留空保持现有密钥不变' : '请输入应用 Secret'}
              value={wechatForm.app_secret}
              onChange={(e) => setWechatForm({ ...wechatForm, app_secret: e.target.value })}
            />
          </div>
        </div>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Secret）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsWechat
