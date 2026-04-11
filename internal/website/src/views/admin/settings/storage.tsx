import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useSettings, SettingsLoading } from './shared'
import S3StorageCard from './S3StorageCard'
import DeliveryCard from './DeliveryCard'
import ImageStylesCard from './ImageStylesCard'

// SettingsStorage provides the S3 storage, resource distribution, and image styles settings page.
function SettingsStorage() {
  const { t } = useTranslation('admin')
  const { loading, settingsMap, reload } = useSettings()

  if (loading) return <SettingsLoading />

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold" style={{ color: '#0f0f0f' }}>{t('admin:storageConfig')}</h1>

      <S3StorageCard settingsMap={settingsMap} reload={reload} />
      <DeliveryCard settingsMap={settingsMap} reload={reload} />
      <ImageStylesCard settingsMap={settingsMap} reload={reload} />

      <div className="p-4 rounded-xl" style={{ background: '#f9f9f9', border: '1px solid #e5e5e5' }}>
        <div className="flex items-center gap-2">
          <Shield size={14} style={{ color: '#166534' }} />
          <span className="text-xs" style={{ color: '#166534' }}>{t('admin:secretKeyStorageNote')}</span>
        </div>
      </div>
    </div>
  )
}

export default SettingsStorage
