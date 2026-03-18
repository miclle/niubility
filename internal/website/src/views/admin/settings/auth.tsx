import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { UserPlus, Globe, Shield } from 'lucide-react'

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
  const [samlForm, setSamlForm] = useState({ idp_metadata_url: '', idp_entity_id: '', idp_sso_url: '', idp_certificate: '' })
  const [hasExistingSamlCert, setHasExistingSamlCert] = useState(false)

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

    const saml = { idp_metadata_url: '', idp_entity_id: '', idp_sso_url: '', idp_certificate: '' }
    saml.idp_metadata_url = settingsMap['sso_saml_idp_metadata_url'] || ''
    saml.idp_entity_id = settingsMap['sso_saml_idp_entity_id'] || ''
    saml.idp_sso_url = settingsMap['sso_saml_idp_sso_url'] || ''
    if (settingsMap['sso_saml_idp_certificate'] === MASKED_VALUE) {
      setHasExistingSamlCert(true)
    } else {
      saml.idp_certificate = settingsMap['sso_saml_idp_certificate'] || ''
    }
    setSamlForm(saml)
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
      'sso_saml_idp_metadata_url': samlForm.idp_metadata_url,
      'sso_saml_idp_entity_id': samlForm.idp_entity_id,
      'sso_saml_idp_sso_url': samlForm.idp_sso_url,
    }
    if (oidcForm.client_secret || !hasExistingOidcSecret) {
      settings['sso_oidc_client_secret'] = oidcForm.client_secret
    }
    if (samlForm.idp_certificate || !hasExistingSamlCert) {
      settings['sso_saml_idp_certificate'] = samlForm.idp_certificate
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

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>敏感信息（如 Secret、Certificate）使用 AES-256-GCM 加密存储</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsAuth
