import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, CheckCircle, XCircle, Loader2, Save, Shield, Globe, UserPlus, HardDrive } from 'lucide-react'

import { listSettings, updateSettings } from 'src/api/setting'

// MASKED_VALUE is the placeholder returned by backend for sensitive values
const MASKED_VALUE = '******'

// AdminSettings provides an interface for managing system settings.
function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Auth settings
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [ssoEnabled, setSSOEnabled] = useState(false)
  const [cookieSecure, setCookieSecure] = useState(false)

  // SSO settings
  const [ssoForm, setSSOForm] = useState({ host: '', client_id: '', secret: '' })
  const [hasExistingSSOSecret, setHasExistingSSOSecret] = useState(false)

  // WeChat settings
  const [hasExistingWechatSecret, setHasExistingWechatSecret] = useState(false)
  const [wechatForm, setWechatForm] = useState({ corp_id: '', app_agentid: '', app_secret: '' })

  // S3 settings
  const [hasExistingS3Secret, setHasExistingS3Secret] = useState(false)
  const [s3Form, setS3Form] = useState({ endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '' })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await listSettings()
      const sso = { host: '', client_id: '', secret: '' }
      const wechat = { corp_id: '', app_agentid: '', app_secret: '' }
      const s3 = { endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '' }

      for (const s of res.data.settings) {
        switch (s.key) {
          case 'registration_enabled':
            setRegistrationEnabled(s.value === 'true')
            break
          case 'sso_enabled':
            setSSOEnabled(s.value === 'true')
            break
          case 'cookie_secure':
            setCookieSecure(s.value === 'true')
            break
          case 'sso_host':
            sso.host = s.value
            break
          case 'sso_client_id':
            sso.client_id = s.value
            break
          case 'sso_secret':
            if (s.value === MASKED_VALUE) {
              setHasExistingSSOSecret(true)
            } else {
              sso.secret = s.value
            }
            break
          case 'wechat.corp_id':
            wechat.corp_id = s.value
            break
          case 'wechat.app_agentid':
            wechat.app_agentid = s.value
            break
          case 'wechat.app_secret':
            if (s.value === MASKED_VALUE) {
              setHasExistingWechatSecret(true)
            } else {
              wechat.app_secret = s.value
            }
            break
          case 's3.endpoint':
            s3.endpoint = s.value
            break
          case 's3.region':
            s3.region = s.value
            break
          case 's3.bucket':
            s3.bucket = s.value
            break
          case 's3.access_key':
            s3.access_key = s.value
            break
          case 's3.secret_key':
            if (s.value === MASKED_VALUE) {
              setHasExistingS3Secret(true)
            } else {
              s3.secret_key = s.value
            }
            break
          case 's3.public_url':
            s3.public_url = s.value
            break
        }
      }
      setSSOForm(sso)
      setWechatForm(wechat)
      setS3Form(s3)
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
      const settings: Record<string, string> = {
        'registration_enabled': registrationEnabled ? 'true' : 'false',
        'sso_enabled': ssoEnabled ? 'true' : 'false',
        'cookie_secure': cookieSecure ? 'true' : 'false',
        'sso_host': ssoForm.host,
        'sso_client_id': ssoForm.client_id,
        'wechat.corp_id': wechatForm.corp_id,
        'wechat.app_agentid': wechatForm.app_agentid,
        's3.endpoint': s3Form.endpoint,
        's3.region': s3Form.region,
        's3.bucket': s3Form.bucket,
        's3.access_key': s3Form.access_key,
        's3.public_url': s3Form.public_url,
      }

      // Only include secrets if user entered a new value
      if (ssoForm.secret || !hasExistingSSOSecret) {
        settings['sso_secret'] = ssoForm.secret
      }
      if (wechatForm.app_secret || !hasExistingWechatSecret) {
        settings['wechat.app_secret'] = wechatForm.app_secret
      }
      if (s3Form.secret_key || !hasExistingS3Secret) {
        settings['s3.secret_key'] = s3Form.secret_key
      }

      await updateSettings({ settings })
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
    <div className="space-y-6 overflow-y-auto">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>系统配置</h1>

      {/* Success / Error messages */}
      {success && (
        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#dcfce7' }}>
          <CheckCircle size={16} style={{ color: '#166534' }} />
          <span className="text-sm" style={{ color: '#166534' }}>配置已保存</span>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: '#fee2e2' }}>
          <XCircle size={16} style={{ color: '#991b1b' }} />
          <span className="text-sm" style={{ color: '#991b1b' }}>{error}</span>
        </div>
      )}

      {/* Authentication settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <UserPlus size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>认证配置</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>开放用户注册</span>
              <p className="text-xs" style={{ color: '#606060' }}>允许新用户自助注册账户（注册后需管理员审核激活）</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ssoEnabled}
              onChange={(e) => setSSOEnabled(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>启用 SSO 登录</span>
              <p className="text-xs" style={{ color: '#606060' }}>允许用户通过 SSO 单点登录</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={cookieSecure}
              onChange={(e) => setCookieSecure(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>Cookie Secure 标志</span>
              <p className="text-xs" style={{ color: '#606060' }}>启用 HTTPS 环境下的 Secure Cookie（生产环境建议开启）</p>
            </div>
          </label>
        </div>
      </div>

      {/* SSO settings (shown when SSO is enabled) */}
      {ssoEnabled && (
        <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
          <div className="flex items-center gap-2 mb-6">
            <Globe size={20} style={{ color: '#0f0f0f' }} />
            <h3 className="font-medium" style={{ color: '#0f0f0f' }}>SSO 配置</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>SSO Host</label>
              <Input
                placeholder="https://sso.example.com"
                value={ssoForm.host}
                onChange={(e) => setSSOForm({ ...ssoForm, host: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Client ID</label>
              <Input
                placeholder="请输入 Client ID"
                value={ssoForm.client_id}
                onChange={(e) => setSSOForm({ ...ssoForm, client_id: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                Secret
                {hasExistingSSOSecret && (
                  <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
                )}
              </label>
              <Input
                type="password"
                placeholder={hasExistingSSOSecret ? '留空保持现有密钥不变' : '请输入 Secret'}
                value={ssoForm.secret}
                onChange={(e) => setSSOForm({ ...ssoForm, secret: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* S3 storage settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <HardDrive size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>存储配置 (S3)</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Endpoint</label>
            <Input
              placeholder="https://s3.amazonaws.com"
              value={s3Form.endpoint}
              onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Region</label>
              <Input
                placeholder="us-east-1"
                value={s3Form.region}
                onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Bucket</label>
              <Input
                placeholder="my-bucket"
                value={s3Form.bucket}
                onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Access Key</label>
            <Input
              placeholder="请输入 Access Key"
              value={s3Form.access_key}
              onChange={(e) => setS3Form({ ...s3Form, access_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
              Secret Key
              {hasExistingS3Secret && (
                <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
              )}
            </label>
            <Input
              type="password"
              placeholder={hasExistingS3Secret ? '留空保持现有密钥不变' : '请输入 Secret Key'}
              value={s3Form.secret_key}
              onChange={(e) => setS3Form({ ...s3Form, secret_key: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Public URL (可选)</label>
            <Input
              placeholder="https://cdn.example.com（留空则使用 Endpoint 拼接）"
              value={s3Form.public_url}
              onChange={(e) => setS3Form({ ...s3Form, public_url: e.target.value })}
            />
            <p className="text-xs mt-1" style={{ color: '#909090' }}>CDN 或自定义域名，用于生成文件的公开访问地址</p>
          </div>
        </div>
      </div>

      {/* WeChat settings */}
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

      {/* Save button */}
      <div>
        <Button
          disabled={saving}
          onClick={handleSave}
          style={{ background: '#0f0f0f', color: '#ffffff', borderRadius: '18px' }}
        >
          {saving ? (
            <><Loader2 size={16} className="animate-spin" /> 保存中...</>
          ) : (
            <><Save size={16} /> 保存配置</>
          )}
        </Button>
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <h4 className="font-medium mb-2" style={{ color: '#0f0f0f' }}>配置说明</h4>
        <ul className="text-sm space-y-1" style={{ color: '#606060' }}>
          <li>• 配置保存在数据库中，保存后立即生效，无需重启服务</li>
          <li>• S3 存储配置完成后即可在内容编辑器中上传文件</li>
          <li>• SSO 和企业微信配置完成后可前往相应页面测试功能</li>
          <li>• 用户注册开放后，新注册用户需管理员在用户管理中审核激活</li>
        </ul>
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #e5e5e5' }}>
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Secret）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
