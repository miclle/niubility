import { Bell } from 'lucide-react'

// NotificationSettings is a placeholder page for notification preferences.
function NotificationSettings() {
  return (
    <div className="mx-auto py-8 px-6" style={{ maxWidth: 960 }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: '#0f0f0f' }}>通知设置</h1>

      <div className="text-center py-16">
        <Bell size={48} className="mx-auto mb-4" style={{ color: '#d4d4d4' }} />
        <p className="text-base font-medium mb-2" style={{ color: '#0f0f0f' }}>通知设置</p>
        <p className="text-sm" style={{ color: '#909090' }}>通知设置功能即将推出，敬请期待。</p>
      </div>
    </div>
  )
}

export default NotificationSettings
