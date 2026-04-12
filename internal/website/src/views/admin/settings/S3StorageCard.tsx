import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { HardDrive } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { MASKED_VALUE, useSaveSettings, SettingsFeedback, SaveButton } from './shared'

// S3StorageCardProps provides the settings map and reload function from the parent.
interface S3StorageCardProps {
  settingsMap: Record<string, string>
  reload: () => Promise<void>
}

// S3StorageCard renders the S3 object storage settings card.
function S3StorageCard({ settingsMap, reload }: S3StorageCardProps) {
  const { t } = useTranslation('admin')
  const { saving, success, error, save } = useSaveSettings(reload)

  const [hasExistingS3Secret, setHasExistingS3Secret] = useState(false)
  const [s3Form, setS3Form] = useState({ endpoint: '', region: '', bucket: '', access_key: '', secret_key: '', public_url: '', cors_origin: '' })

  useEffect(() => {
    const s3 = {
      endpoint: settingsMap['s3.endpoint'] || '',
      region: settingsMap['s3.region'] || '',
      bucket: settingsMap['s3.bucket'] || '',
      access_key: settingsMap['s3.access_key'] || '',
      secret_key: '',
      public_url: settingsMap['s3.public_url'] || '',
      cors_origin: settingsMap['s3.cors_origin'] || '',
    }
    if (settingsMap['s3.secret_key'] === MASKED_VALUE) {
      setHasExistingS3Secret(true)
    } else {
      s3.secret_key = settingsMap['s3.secret_key'] || ''
    }
    setS3Form(s3)
  }, [settingsMap])

  const handleSave = () => {
    const settings: Record<string, string> = {
      's3.endpoint': s3Form.endpoint,
      's3.region': s3Form.region,
      's3.bucket': s3Form.bucket,
      's3.access_key': s3Form.access_key,
      's3.public_url': s3Form.public_url,
      's3.cors_origin': s3Form.cors_origin,
    }
    if (s3Form.secret_key || !hasExistingS3Secret) {
      settings['s3.secret_key'] = s3Form.secret_key
    }
    save(settings)
  }

  return (
    <div className="app-surface-elevated rounded-xl p-6 border app-border">
      <div className="flex items-center gap-2 mb-6">
        <HardDrive size={20} className="text-foreground" />
        <h3 className="font-medium text-foreground">{t('admin:objectStorageConfig')}</h3>
      </div>

      <SettingsFeedback success={success} error={error} />

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:serviceEndpoint')}</label>
          <Input
            placeholder={t('admin:serviceEndpointPlaceholder')}
            value={s3Form.endpoint}
            onChange={(e) => setS3Form({ ...s3Form, endpoint: e.target.value })}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:serviceEndpointExample')}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:storageRegion')}</label>
            <Input
              placeholder={t('admin:storageRegionPlaceholder')}
              value={s3Form.region}
              onChange={(e) => setS3Form({ ...s3Form, region: e.target.value })}
            />
            <p className="app-text-tertiary text-xs mt-1">{t('admin:storageRegionExample')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:storageBucket')}</label>
            <Input
              placeholder={t('admin:storageBucketPlaceholder')}
              value={s3Form.bucket}
              onChange={(e) => setS3Form({ ...s3Form, bucket: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:accessKey')}</label>
          <Input
            placeholder={t('admin:accessKeyPlaceholder')}
            value={s3Form.access_key}
            onChange={(e) => setS3Form({ ...s3Form, access_key: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">
            {t('admin:secretKey')}
            {hasExistingS3Secret && (
              <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">{t('admin:secretSetHint')}</span>
            )}
          </label>
          <Input
            type="password"
            placeholder={hasExistingS3Secret ? t('admin:secretKeyPlaceholderSet') : t('admin:secretKeyPlaceholderNew')}
            value={s3Form.secret_key}
            onChange={(e) => setS3Form({ ...s3Form, secret_key: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:publicURL')}</label>
          <Input
            placeholder={t('admin:publicURLPlaceholder')}
            value={s3Form.public_url}
            onChange={(e) => setS3Form({ ...s3Form, public_url: e.target.value })}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:publicURLExample')}</p>
          <p className="app-text-tertiary text-xs mt-1">{t('admin:publicURLHelp')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-foreground">{t('admin:corsOrigin')}</label>
          <Textarea
            rows={3}
            placeholder={"http://localhost:9000\nhttps://example.com"}
            value={s3Form.cors_origin}
            onChange={(e) => setS3Form({ ...s3Form, cors_origin: e.target.value })}
          />
          <p className="app-text-tertiary text-xs mt-1">{t('admin:corsOriginHelp')}</p>
        </div>
      </div>

      <div className="mt-6">
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  )
}

export default S3StorageCard
