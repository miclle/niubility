import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'

// OidcForm holds the OIDC configuration form values.
export interface OidcForm {
  issuer: string
  client_id: string
  client_secret: string
}

// OIDCSettingsSectionProps defines props for the OIDC settings section.
interface OIDCSettingsSectionProps {
  form: OidcForm
  hasExistingSecret: boolean
  onChange: (form: OidcForm) => void
}

// OIDCSettingsSection renders the OIDC SSO configuration fields.
function OIDCSettingsSection({ form, hasExistingSecret, onChange }: OIDCSettingsSectionProps) {
  const { t } = useTranslation('admin')

  return (
    <div className="space-y-4 pt-2 border-t app-border">
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:issuerURL')}</label>
        <Input
          placeholder="https://accounts.google.com"
          value={form.issuer}
          onChange={(e) => onChange({ ...form, issuer: e.target.value })}
        />
        <p className="app-text-tertiary text-xs mt-1">{t('admin:issuerURLHelp')}</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:clientID')}</label>
        <Input
          placeholder={t('admin:clientIDPlaceholder')}
          value={form.client_id}
          onChange={(e) => onChange({ ...form, client_id: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-foreground">
          {t('admin:clientSecret')}
          {hasExistingSecret && (
            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">{t('admin:secretSetHint')}</span>
          )}
        </label>
        <Input
          type="password"
          placeholder={hasExistingSecret ? t('admin:clientSecretPlaceholderSet') : t('admin:clientSecretPlaceholderNew')}
          value={form.client_secret}
          onChange={(e) => onChange({ ...form, client_secret: e.target.value })}
        />
      </div>
    </div>
  )
}

export default OIDCSettingsSection
