import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Settings, CheckCircle, XCircle, Loader2, Save, Shield, Globe, UserPlus, HardDrive } from 'lucide-react'

import { listSettings, updateSettings } from 'src/api/setting'

// MASKED_VALUE is the placeholder returned by backend for sensitive values
const MASKED_VALUE = '******'

// SSOType represents the active SSO protocol.
type SSOType = 'disabled' | 'oidc' | 'saml'

// AdminSettings provides an interface for managing system settings.
function AdminSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  // Auth settings
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [cookieSecure, setCookieSecure] = useState(false)

  // SSO settings
  const [ssoType, setSSOType] = useState<SSOType>('disabled')
  const [oidcForm, setOidcForm] = useState({ issuer: '', client_id: '', client_secret: '' })
  const [hasExistingOidcSecret, setHasExistingOidcSecret] = useState(false)
  const [samlForm, setSamlForm] = useState({ idp_metadata_url: '', idp_entity_id: '', idp_sso_url: '', idp_certificate: '' })
  const [hasExistingSamlCert, setHasExistingSamlCert] = useState(false)

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
      const oidc = { issuer: '', client_id: '', client_secret: '' }
      const saml = { idp_metadata_url: '', idp_entity_id: '', idp_sso_url: '', idp_certificate: '' }
      const wechat = { corp_id: '', app_agentid: '', app_secret: '' }
      const s3 = { endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '' }

      for (const s of res.data.settings) {
        switch (s.key) {
          case 'registration_enabled':
            setRegistrationEnabled(s.value === 'true')
            break
          case 'cookie_secure':
            setCookieSecure(s.value === 'true')
            break
          case 'sso_type':
            setSSOType((s.value || 'disabled') as SSOType)
            break
          case 'sso_oidc_issuer':
            oidc.issuer = s.value
            break
          case 'sso_oidc_client_id':
            oidc.client_id = s.value
            break
          case 'sso_oidc_client_secret':
            if (s.value === MASKED_VALUE) {
              setHasExistingOidcSecret(true)
            } else {
              oidc.client_secret = s.value
            }
            break
          case 'sso_saml_idp_metadata_url':
            saml.idp_metadata_url = s.value
            break
          case 'sso_saml_idp_entity_id':
            saml.idp_entity_id = s.value
            break
          case 'sso_saml_idp_sso_url':
            saml.idp_sso_url = s.value
            break
          case 'sso_saml_idp_certificate':
            if (s.value === MASKED_VALUE) {
              setHasExistingSamlCert(true)
            } else {
              saml.idp_certificate = s.value
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
      setOidcForm(oidc)
      setSamlForm(saml)
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
        'cookie_secure': cookieSecure ? 'true' : 'false',
        'sso_type': ssoType,
        'sso_oidc_issuer': oidcForm.issuer,
        'sso_oidc_client_id': oidcForm.client_id,
        'sso_saml_idp_metadata_url': samlForm.idp_metadata_url,
        'sso_saml_idp_entity_id': samlForm.idp_entity_id,
        'sso_saml_idp_sso_url': samlForm.idp_sso_url,
        'wechat.corp_id': wechatForm.corp_id,
        'wechat.app_agentid': wechatForm.app_agentid,
        's3.endpoint': s3Form.endpoint,
        's3.region': s3Form.region,
        's3.bucket': s3Form.bucket,
        's3.access_key': s3Form.access_key,
        's3.public_url': s3Form.public_url,
      }

      // Only include secrets if user entered a new value
      if (oidcForm.client_secret || !hasExistingOidcSecret) {
        settings['sso_oidc_client_secret'] = oidcForm.client_secret
      }
      if (samlForm.idp_certificate || !hasExistingSamlCert) {
        settings['sso_saml_idp_certificate'] = samlForm.idp_certificate
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

      {/* SSO settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Globe size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>SSO 配置</h3>
        </div>

        <div className="space-y-4">
          {/* SSO type selector */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#0f0f0f' }}>SSO 类型</label>
            <div className="flex gap-4">
              {([
                { value: 'disabled', label: '关闭' },
                { value: 'oidc', label: 'OIDC' },
                { value: 'saml', label: 'SAML 2.0' },
              ] as const).map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="sso_type"
                    value={opt.value}
                    checked={ssoType === opt.value}
                    onChange={() => setSSOType(opt.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: '#0f0f0f' }}>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* OIDC fields */}
          {ssoType === 'oidc' && (
            <div className="space-y-4 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Issuer URL</label>
                <Input
                  placeholder="https://accounts.google.com"
                  value={oidcForm.issuer}
                  onChange={(e) => setOidcForm({ ...oidcForm, issuer: e.target.value })}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>OIDC 提供商的 Issuer URL，用于自动发现配置</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>Client ID</label>
                <Input
                  placeholder="请输入 Client ID"
                  value={oidcForm.client_id}
                  onChange={(e) => setOidcForm({ ...oidcForm, client_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                  Client Secret
                  {hasExistingOidcSecret && (
                    <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
                  )}
                </label>
                <Input
                  type="password"
                  placeholder={hasExistingOidcSecret ? '留空保持现有密钥不变' : '请输入 Client Secret'}
                  value={oidcForm.client_secret}
                  onChange={(e) => setOidcForm({ ...oidcForm, client_secret: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* SAML fields */}
          {ssoType === 'saml' && (
            <div className="space-y-4 pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>IdP Metadata URL（可选）</label>
                <Input
                  placeholder="https://sso.example.com/metadata"
                  value={samlForm.idp_metadata_url}
                  onChange={(e) => setSamlForm({ ...samlForm, idp_metadata_url: e.target.value })}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>IdP 的 SAML Metadata URL，用于参考配置</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>IdP Entity ID</label>
                <Input
                  placeholder="https://sso.example.com"
                  value={samlForm.idp_entity_id}
                  onChange={(e) => setSamlForm({ ...samlForm, idp_entity_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>IdP SSO URL</label>
                <Input
                  placeholder="https://sso.example.com/saml/sso"
                  value={samlForm.idp_sso_url}
                  onChange={(e) => setSamlForm({ ...samlForm, idp_sso_url: e.target.value })}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>IdP 的 SAML 单点登录端点地址</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                  IdP Certificate (PEM)
                  {hasExistingSamlCert && (
                    <span className="ml-2 text-xs" style={{ color: '#166534' }}>(已设置，留空保持不变)</span>
                  )}
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm font-mono"
                  style={{ borderColor: '#e5e5e5', minHeight: '120px' }}
                  placeholder={hasExistingSamlCert ? '留空保持现有证书不变' : '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                  value={samlForm.idp_certificate}
                  onChange={(e) => setSamlForm({ ...samlForm, idp_certificate: e.target.value })}
                />
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-sm font-medium" style={{ color: '#0369a1' }}>SP Metadata</p>
                <p className="text-xs mt-1" style={{ color: '#0369a1' }}>
                  将以下地址提供给 IdP 以导入 SP 配置：
                </p>
                <code className="block text-xs mt-1 p-2 rounded" style={{ background: '#e0f2fe', color: '#0c4a6e' }}>
                  {window.location.origin}/sso/metadata
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

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
          <li>• SSO 支持 OIDC（Google、Azure AD、Okta 等）和 SAML 2.0（七牛 SSO、AD FS 等）协议</li>
          <li>• S3 存储配置完成后即可在内容编辑器中上传文件</li>
          <li>• 用户注册开放后，新注册用户需管理员在用户管理中审核激活</li>
        </ul>
        <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #e5e5e5' }}>
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Secret、Certificate）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default AdminSettings
