import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserPlus, Globe, Shield, Copy, Download } from 'lucide-react'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SSOType represents the active SSO protocol.
type SSOType = 'disabled' | 'oidc' | 'saml'

// SettingsAuth provides the authentication and SSO settings page.
function SettingsAuth() {
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  // Auth settings
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [cookieSecure, setCookieSecure] = useState(false)

  // SSO settings
  const [ssoType, setSSOType] = useState<SSOType>('disabled')
  const [oidcForm, setOidcForm] = useState({ issuer: '', client_id: '', client_secret: '' })
  const [hasExistingOidcSecret, setHasExistingOidcSecret] = useState(false)
  const [samlMetadataURL, setSamlMetadataURL] = useState('')
  const [copied, setCopied] = useState(false)

  const spMetadataURL = `${window.location.origin}/sso/metadata`

  const handleCopyURL = async () => {
    try {
      await navigator.clipboard.writeText(spMetadataURL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = spMetadataURL
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownloadXML = () => {
    const link = document.createElement('a')
    link.href = spMetadataURL
    link.download = 'sp-niubility-metadata.xml'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  useEffect(() => {
    if (loading) return

    // Auth
    setRegistrationEnabled(settingsMap['registration_enabled'] === 'true')
    setCookieSecure(settingsMap['cookie_secure'] === 'true')

    // SSO
    setSSOType((settingsMap['sso_type'] || 'disabled') as SSOType)

    const oidc = { issuer: '', client_id: '', client_secret: '' }
    oidc.issuer = settingsMap['sso_oidc_issuer'] || ''
    oidc.client_id = settingsMap['sso_oidc_client_id'] || ''
    if (settingsMap['sso_oidc_client_secret'] === MASKED_VALUE) {
      setHasExistingOidcSecret(true)
    } else {
      oidc.client_secret = settingsMap['sso_oidc_client_secret'] || ''
    }
    setOidcForm(oidc)

    setSamlMetadataURL(settingsMap['sso_saml_idp_metadata_url'] || '')
  }, [loading, settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      // Auth
      'registration_enabled': registrationEnabled ? 'true' : 'false',
      'cookie_secure': cookieSecure ? 'true' : 'false',
      // SSO
      'sso_type': ssoType,
      'sso_oidc_issuer': oidcForm.issuer,
      'sso_oidc_client_id': oidcForm.client_id,
      'sso_saml_idp_metadata_url': samlMetadataURL,
    }
    if (oidcForm.client_secret || !hasExistingOidcSecret) {
      settings['sso_oidc_client_secret'] = oidcForm.client_secret
    }
    save(settings)
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>认证配置</h1>

      <SettingsFeedback success={success} error={error} />

      {/* Authentication settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <UserPlus size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>基本认证</h3>
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
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>IdP Metadata URL（身份提供者）</label>
                <Input
                  placeholder="https://sso.example.com/saml2/meta"
                  value={samlMetadataURL}
                  onChange={(e) => setSamlMetadataURL(e.target.value)}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>IdP 的 SAML Metadata URL，系统将自动解析 Entity ID、SSO URL 和证书</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-sm font-medium" style={{ color: '#0369a1' }}>SP Metadata（服务提供者，即本系统）</p>
                <p className="text-xs mt-1" style={{ color: '#0369a1' }}>
                  将以下地址提供给身份提供者（IdP）管理员以导入本系统配置：
                </p>
                <code className="block text-xs mt-1 p-2 rounded" style={{ background: '#e0f2fe', color: '#0c4a6e' }}>
                  {spMetadataURL}
                </code>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={handleCopyURL} className="h-7 text-xs">
                    <Copy size={12} className="mr-1" />
                    {copied ? '已复制' : '复制链接'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadXML} className="h-7 text-xs">
                    <Download size={12} className="mr-1" />
                    下载 XML
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Client Secret、Secret Key）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsAuth
