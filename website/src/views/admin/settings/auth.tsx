import { useState, useEffect } from 'react'
import { UserPlus, Globe, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MASKED_VALUE, useSettings, useSaveSettings, SettingsLoading, SettingsFeedback, SaveButton } from './shared'
import OIDCSettingsSection, { type OidcForm } from './OIDCSettingsSection'
import SAMLSettingsSection, { type SamlForm, type NameIDFormat } from './SAMLSettingsSection'

// SSOType represents the active SSO protocol.
type SSOType = 'disabled' | 'oidc' | 'saml'

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
  const [oidcForm, setOidcForm] = useState<OidcForm>({ issuer: '', client_id: '', client_secret: '' })
  const [hasExistingOidcSecret, setHasExistingOidcSecret] = useState(false)

  // SAML settings
  const [samlMetadataURL, setSamlMetadataURL] = useState('')
  const [samlAdvancedExpanded, setSamlAdvancedExpanded] = useState(false)
  const [samlForm, setSamlForm] = useState<SamlForm>({
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
    const oidc: OidcForm = { issuer: '', client_id: '', client_secret: '' }
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
    const saml: SamlForm = {
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
    <div className="app-surface space-y-6">
      <h1 className="text-xl font-semibold text-foreground">{t('admin:authSettings')}</h1>

      <SettingsFeedback success={success} error={error} />

      {/* Authentication settings */}
      <div className="app-surface-elevated rounded-xl p-6 border app-border">
        <div className="flex items-center gap-2 mb-6">
          <UserPlus size={20} className="text-foreground" />
          <h3 className="font-medium text-foreground">{t('admin:basicAuth')}</h3>
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
              <span className="text-sm font-medium text-foreground">{t('admin:registrationEnabled')}</span>
              <p className="app-text-secondary text-xs">{t('admin:registrationEnabledDesc')}</p>
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
              <span className="text-sm font-medium text-foreground">{t('admin:cookieSecureLabel')}</span>
              <p className="app-text-secondary text-xs">{t('admin:cookieSecureDesc')}</p>
            </div>
          </label>
        </div>
      </div>

      {/* SSO settings */}
      <div className="app-surface-elevated rounded-xl p-6 border app-border">
        <div className="flex items-center gap-2 mb-6">
          <Globe size={20} className="text-foreground" />
          <h3 className="font-medium text-foreground">{t('admin:ssoConfig')}</h3>
        </div>

        <div className="space-y-4">
          {/* SSO type selector */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">{t('admin:ssoType')}</label>
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
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* OIDC fields */}
          {ssoType === 'oidc' && (
            <OIDCSettingsSection
              form={oidcForm}
              hasExistingSecret={hasExistingOidcSecret}
              onChange={setOidcForm}
            />
          )}

          {/* SAML fields */}
          {ssoType === 'saml' && (
            <SAMLSettingsSection
              metadataURL={samlMetadataURL}
              samlForm={samlForm}
              hasExistingPrivateKey={hasExistingSAMLPrivateKey}
              advancedExpanded={samlAdvancedExpanded}
              spMetadataURL={spMetadataURL}
              copied={copied}
              onMetadataURLChange={setSamlMetadataURL}
              onFormChange={setSamlForm}
              onToggleAdvanced={() => setSamlAdvancedExpanded(!samlAdvancedExpanded)}
              onCopyURL={handleCopyURL}
              onDownloadXML={handleDownloadXML}
            />
          )}
        </div>
      </div>

      <SaveButton saving={saving} onClick={handleSave} />

      <div className="app-surface-muted p-4 rounded-xl border app-border">
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>{t('admin:sensitiveInfoNote')}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsAuth
