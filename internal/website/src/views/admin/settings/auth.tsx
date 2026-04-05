import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserPlus, Globe, Shield, Copy, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'

// SSOType represents the active SSO protocol.
type SSOType = 'disabled' | 'oidc' | 'saml'

// NameIDFormat represents the NameID format options.
type NameIDFormat = 'unspecified' | 'email' | 'transient' | 'persistent'

// SettingsAuth provides the authentication and SSO settings page.
function SettingsAuth() {
  const { t } = useTranslation('admin')
  const { loading, settingsMap, reload } = useSettings()
  const { saving, success, error, save } = useSaveSettings(reload)

  // Auth settings
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [cookieSecure, setCookieSecure] = useState(false)

  // SSO settings
  const [ssoType, setSSOType] = useState<SSOType>('disabled')
  const [oidcForm, setOidcForm] = useState({ issuer: '', client_id: '', client_secret: '' })
  const [hasExistingOidcSecret, setHasExistingOidcSecret] = useState(false)

  // SAML settings
  const [samlMetadataURL, setSamlMetadataURL] = useState('')
  const [samlAdvancedExpanded, setSamlAdvancedExpanded] = useState(false)
  const [samlForm, setSamlForm] = useState({
    sp_certificate: '',
    sp_private_key: '',
    nameid_format: 'unspecified' as NameIDFormat,
    attribute_mapping: '',
  })
  const [hasExistingSAMLPrivateKey, setHasExistingSAMLPrivateKey] = useState(false)

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

    // OIDC
    const oidc = { issuer: '', client_id: '', client_secret: '' }
    oidc.issuer = settingsMap['sso_oidc_issuer'] || ''
    oidc.client_id = settingsMap['sso_oidc_client_id'] || ''
    if (settingsMap['sso_oidc_client_secret'] === MASKED_VALUE) {
      setHasExistingOidcSecret(true)
    } else {
      oidc.client_secret = settingsMap['sso_oidc_client_secret'] || ''
    }
    setOidcForm(oidc)

    // SAML
    setSamlMetadataURL(settingsMap['sso_saml_idp_metadata_url'] || '')
    const saml = {
      sp_certificate: settingsMap['sso_saml_sp_certificate'] || '',
      sp_private_key: '',
      nameid_format: (settingsMap['sso_saml_nameid_format'] || 'unspecified') as NameIDFormat,
      attribute_mapping: settingsMap['sso_saml_attribute_mapping'] || '',
    }
    if (settingsMap['sso_saml_sp_private_key'] === MASKED_VALUE) {
      setHasExistingSAMLPrivateKey(true)
    } else {
      saml.sp_private_key = settingsMap['sso_saml_sp_private_key'] || ''
    }
    setSamlForm(saml)

    // Expand advanced section if any advanced config exists
    if (saml.sp_certificate || settingsMap['sso_saml_sp_private_key'] || saml.attribute_mapping) {
      setSamlAdvancedExpanded(true)
    }
  }, [loading, settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      // Auth
      'registration_enabled': registrationEnabled ? 'true' : 'false',
      'cookie_secure': cookieSecure ? 'true' : 'false',
      // SSO
      'sso_type': ssoType,
      // OIDC
      'sso_oidc_issuer': oidcForm.issuer,
      'sso_oidc_client_id': oidcForm.client_id,
      // SAML
      'sso_saml_idp_metadata_url': samlMetadataURL,
      'sso_saml_sp_certificate': samlForm.sp_certificate,
      'sso_saml_nameid_format': samlForm.nameid_format,
      'sso_saml_attribute_mapping': samlForm.attribute_mapping,
    }

    // OIDC secret
    if (oidcForm.client_secret || !hasExistingOidcSecret) {
      settings['sso_oidc_client_secret'] = oidcForm.client_secret
    }

    // SAML private key
    if (samlForm.sp_private_key || !hasExistingSAMLPrivateKey) {
      settings['sso_saml_sp_private_key'] = samlForm.sp_private_key
    }

    save(settings)
  }

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>{t('admin:authSettings')}</h1>

      <SettingsFeedback success={success} error={error} />

      {/* Authentication settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <UserPlus size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:basicAuth')}</h3>
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
              <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>{t('admin:registrationEnabled')}</span>
              <p className="text-xs" style={{ color: '#606060' }}>{t('admin:registrationEnabledDesc')}</p>
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
              <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>{t('admin:cookieSecureLabel')}</span>
              <p className="text-xs" style={{ color: '#606060' }}>{t('admin:cookieSecureDesc')}</p>
            </div>
          </label>
        </div>
      </div>

      {/* SSO settings */}
      <div className="bg-white rounded-xl p-6" style={{ border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2 mb-6">
          <Globe size={20} style={{ color: '#0f0f0f' }} />
          <h3 className="font-medium" style={{ color: '#0f0f0f' }}>{t('admin:ssoConfig')}</h3>
        </div>

        <div className="space-y-4">
          {/* SSO type selector */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#0f0f0f' }}>{t('admin:ssoType')}</label>
            <div className="flex gap-4">
              {([
                { value: 'disabled', label: t('admin:disabled') },
                { value: 'oidc', label: t('admin:ssoOidc') },
                { value: 'saml', label: t('admin:ssoSaml') },
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
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:issuerURL')}</label>
                <Input
                  placeholder="https://accounts.google.com"
                  value={oidcForm.issuer}
                  onChange={(e) => setOidcForm({ ...oidcForm, issuer: e.target.value })}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:issuerURLHelp')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:clientID')}</label>
                <Input
                  placeholder={t('admin:clientIDPlaceholder')}
                  value={oidcForm.client_id}
                  onChange={(e) => setOidcForm({ ...oidcForm, client_id: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                  {t('admin:clientSecret')}
                  {hasExistingOidcSecret && (
                    <span className="ml-2 text-xs" style={{ color: '#166534' }}>{t('admin:secretSetHint')}</span>
                  )}
                </label>
                <Input
                  type="password"
                  placeholder={hasExistingOidcSecret ? t('admin:clientSecretPlaceholderSet') : t('admin:clientSecretPlaceholderNew')}
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
                <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>{t('admin:idpMetadataURL')}</label>
                <Input
                  placeholder="https://sso.example.com/saml2/meta"
                  value={samlMetadataURL}
                  onChange={(e) => setSamlMetadataURL(e.target.value)}
                />
                <p className="text-xs mt-1" style={{ color: '#909090' }}>{t('admin:idpMetadataURLHelp')}</p>
              </div>
              <div className="p-3 rounded-lg" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                <p className="text-sm font-medium" style={{ color: '#0369a1' }}>{t('admin:spMetadata')}</p>
                <p className="text-xs mt-1" style={{ color: '#0369a1' }}>
                  {t('admin:spMetadataHelp')}
                </p>
                <code className="block text-xs mt-1 p-2 rounded" style={{ background: '#e0f2fe', color: '#0c4a6e' }}>
                  {spMetadataURL}
                </code>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={handleCopyURL} className="h-7 text-xs">
                    <Copy size={12} className="mr-1" />
                    {copied ? t('admin:copied') : t('admin:copyLink')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadXML} className="h-7 text-xs">
                    <Download size={12} className="mr-1" />
                    {t('admin:downloadXML')}
                  </Button>
                </div>
              </div>

              {/* Advanced SAML configuration */}
              <div className="pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                <button
                  type="button"
                  onClick={() => setSamlAdvancedExpanded(!samlAdvancedExpanded)}
                  className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
                  style={{ color: '#0f0f0f' }}
                >
                  {samlAdvancedExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {t('admin:advancedConfig')}
                </button>

                {samlAdvancedExpanded && (
                  <div className="mt-4 space-y-4 pl-6">
                    {/* SP Signing */}
                    <div className="p-3 rounded-lg" style={{ background: '#fafafa' }}>
                      <p className="text-sm font-medium mb-3" style={{ color: '#0f0f0f' }}>
                        {t('admin:spSigningConfig')}
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#606060' }}>
                        {t('admin:spSigningConfigHelp')}
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            {t('admin:spCertificate')}
                          </label>
                          <Textarea
                            rows={4}
                            placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                            value={samlForm.sp_certificate}
                            onChange={(e) => setSamlForm({ ...samlForm, sp_certificate: e.target.value })}
                            className="font-mono text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                            {t('admin:spPrivateKey')}
                            {hasExistingSAMLPrivateKey && (
                              <span className="ml-2 text-xs" style={{ color: '#166534' }}>
                                {t('admin:secretSetHint')}
                              </span>
                            )}
                          </label>
                          <Textarea
                            rows={4}
                            placeholder={hasExistingSAMLPrivateKey ? t('admin:clientSecretPlaceholderSet') : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                            value={samlForm.sp_private_key}
                            onChange={(e) => setSamlForm({ ...samlForm, sp_private_key: e.target.value })}
                            className="font-mono text-xs"
                          />
                          <p className="text-xs mt-1" style={{ color: '#909090' }}>
                            {t('admin:privateKeyEncryption')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* NameID Format */}
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                        {t('admin:nameIDFormat')}
                      </label>
                      <Select
                        value={samlForm.nameid_format}
                        onValueChange={(v) => setSamlForm({ ...samlForm, nameid_format: v as NameIDFormat })}
                      >
                        <SelectTrigger className="w-64">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unspecified">{t('admin:nameIDFormatUnspecified')}</SelectItem>
                          <SelectItem value="email">{t('admin:nameIDFormatEmail')}</SelectItem>
                          <SelectItem value="transient">{t('admin:nameIDFormatTransient')}</SelectItem>
                          <SelectItem value="persistent">{t('admin:nameIDFormatPersistent')}</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs mt-1" style={{ color: '#909090' }}>
                        {t('admin:nameIDFormatHelp')}
                      </p>
                    </div>

                    {/* Attribute Mapping */}
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: '#0f0f0f' }}>
                        {t('admin:attributeMapping')}
                      </label>
                      <Textarea
                        rows={4}
                        placeholder={'{\n  "uid": "username",\n  "mail": "email",\n  "displayName": "name"\n}'}
                        value={samlForm.attribute_mapping}
                        onChange={(e) => setSamlForm({ ...samlForm, attribute_mapping: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <p className="text-xs mt-1" style={{ color: '#909090' }}>
                        {t('admin:attributeMappingHelp')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>{t('admin:sensitiveInfoNote')}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsAuth
