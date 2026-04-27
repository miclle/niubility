import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// NotificationSettings is a placeholder page for notification preferences.
function NotificationSettings() {
  const { t } = useTranslation('settings')
  return (
    <div className="app-surface min-h-full">
      <div className="border-b app-border px-6 py-8 lg:px-12">
        <h1 className="text-[2rem] font-semibold tracking-tight text-foreground">{t('settings:notificationSettings')}</h1>
      </div>

      <div className="max-w-[720px] px-6 py-16 text-center lg:px-12">
        <Bell size={48} className="app-text-tertiary mx-auto mb-4" />
        <p className="text-base font-medium mb-2 text-foreground">{t('settings:notificationSettings')}</p>
        <p className="app-text-tertiary text-sm">{t('settings:notificationSettingsComing')}</p>
      </div>
    </div>
  )
}

export default NotificationSettings
