import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Copy, Download, ChevronDown, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// NameIDFormat represents the NameID format options.
export type NameIDFormat = 'unspecified' | 'email' | 'transient' | 'persistent'

// SamlForm holds the SAML advanced configuration form values.
export interface SamlForm {
  sp_certificate: string
  sp_private_key: string
  nameid_format: NameIDFormat
  attribute_mapping: string
}

// SAMLSettingsSectionProps defines props for the SAML settings section.
interface SAMLSettingsSectionProps {
  metadataURL: string
  samlForm: SamlForm
  hasExistingPrivateKey: boolean
  advancedExpanded: boolean
  spMetadataURL: string
  copied: boolean
  onMetadataURLChange: (url: string) => void
  onFormChange: (form: SamlForm) => void
  onToggleAdvanced: () => void
  onCopyURL: () => void
  onDownloadXML: () => void
}

// SAMLSettingsSection renders the SAML SSO configuration fields.
function SAMLSettingsSection({
  metadataURL, samlForm, hasExistingPrivateKey, advancedExpanded,
  spMetadataURL, copied,
  onMetadataURLChange, onFormChange, onToggleAdvanced, onCopyURL, onDownloadXML,
}: SAMLSettingsSectionProps) {
  const { t } = useTranslation('admin')

  return (
    <div className="space-y-4 pt-2 border-t app-border">
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:idpMetadataURL')}</label>
        <Input
          placeholder="https://sso.example.com/saml2/meta"
          value={metadataURL}
          onChange={(e) => onMetadataURLChange(e.target.value)}
        />
        <p className="app-text-tertiary text-xs mt-1">{t('admin:idpMetadataURLHelp')}</p>
      </div>
      <div className="p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--brand) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)' }}>
        <p className="text-sm font-medium" style={{ color: '#0369a1' }}>{t('admin:spMetadata')}</p>
        <p className="text-xs mt-1" style={{ color: '#0369a1' }}>
          {t('admin:spMetadataHelp')}
        </p>
        <code className="block text-xs mt-1 p-2 rounded" style={{ background: 'color-mix(in srgb, var(--brand) 14%, transparent)', color: 'var(--foreground)' }}>
          {spMetadataURL}
        </code>
        <div className="flex gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onCopyURL} className="h-7 text-xs">
            <Copy size={12} className="mr-1" />
            {copied ? t('admin:copied') : t('admin:copyLink')}
          </Button>
          <Button variant="outline" size="sm" onClick={onDownloadXML} className="h-7 text-xs">
            <Download size={12} className="mr-1" />
            {t('admin:downloadXML')}
          </Button>
        </div>
      </div>

      {/* Advanced SAML configuration */}
      <div className="pt-2 border-t app-border">
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="flex items-center gap-2 text-sm font-medium cursor-pointer bg-transparent border-0 p-0"
          style={{ color: 'var(--foreground)' }}
        >
          {advancedExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t('admin:advancedConfig')}
        </button>

        {advancedExpanded && (
          <div className="mt-4 space-y-4 pl-6">
            {/* SP Signing */}
            <div className="app-surface-muted p-3 rounded-lg">
              <p className="text-sm font-medium mb-3 text-foreground">
                {t('admin:spSigningConfig')}
              </p>
              <p className="app-text-secondary text-xs mb-3">
                {t('admin:spSigningConfigHelp')}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">
                    {t('admin:spCertificate')}
                  </label>
                  <Textarea
                    rows={4}
                    placeholder={'-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'}
                    value={samlForm.sp_certificate}
                    onChange={(e) => onFormChange({ ...samlForm, sp_certificate: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">
                    {t('admin:spPrivateKey')}
                    {hasExistingPrivateKey && (
                      <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                        {t('admin:secretSetHint')}
                      </span>
                    )}
                  </label>
                  <Textarea
                    rows={4}
                    placeholder={hasExistingPrivateKey ? t('admin:clientSecretPlaceholderSet') : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                    value={samlForm.sp_private_key}
                    onChange={(e) => onFormChange({ ...samlForm, sp_private_key: e.target.value })}
                    className="font-mono text-xs"
                  />
                  <p className="app-text-tertiary text-xs mt-1">
                    {t('admin:privateKeyEncryption')}
                  </p>
                </div>
              </div>
            </div>

            {/* NameID Format */}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                {t('admin:nameIDFormat')}
              </label>
              <Select
                value={samlForm.nameid_format}
                onValueChange={(v) => onFormChange({ ...samlForm, nameid_format: v as NameIDFormat })}
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
              <p className="app-text-tertiary text-xs mt-1">
                {t('admin:nameIDFormatHelp')}
              </p>
            </div>

            {/* Attribute Mapping */}
            <div>
              <label className="block text-sm font-medium mb-1 text-foreground">
                {t('admin:attributeMapping')}
              </label>
              <Textarea
                rows={4}
                placeholder={'{\n  "uid": "username",\n  "mail": "email",\n  "displayName": "name"\n}'}
                value={samlForm.attribute_mapping}
                onChange={(e) => onFormChange({ ...samlForm, attribute_mapping: e.target.value })}
                className="font-mono text-xs"
              />
              <p className="app-text-tertiary text-xs mt-1">
                {t('admin:attributeMappingHelp')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default SAMLSettingsSection
