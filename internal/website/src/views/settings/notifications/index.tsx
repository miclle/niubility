import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// NotificationSettings is a placeholder page for notification preferences.
function NotificationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>{t('settings:notificationSettings')}</h1>

      <div className="text-center py-16">
        <Bell size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
        <p className="text-base font-medium mb-2" style={{ color: '#0f0f0f' }}>{t('settings:notificationSettings')}</p>
        <p className="text-sm" style={{ color: '#909090' }}>{t('settings:notificationSettingsComing')}</p>
      </div>
    </div>
  )
}

export default NotificationSettings
