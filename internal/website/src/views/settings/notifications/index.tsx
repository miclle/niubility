import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// NotificationSettings is a placeholder page for notification preferences.
function NotificationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div className="min-h-full bg-white">
      <div className="border-b border-[#ececec] px-6 py-8 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight" style={{ color: '#0f0f0f' }}>{t('settings:notificationSettings')}</h1>
      </div>

      <div className="max-w-[720px] px-6 py-16 text-center lg:px-12">
        <Bell size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
        <p className="text-base font-medium mb-2" style={{ color: '#0f0f0f' }}>{t('settings:notificationSettings')}</p>
        <p className="text-sm" style={{ color: '#909090' }}>{t('settings:notificationSettingsComing')}</p>
      </div>
    </div>
  )
}

export default NotificationSettings
