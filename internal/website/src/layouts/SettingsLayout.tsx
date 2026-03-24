import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { User, FileText, Shield, Bell, ArrowLeft, Bookmark, type LucideIcon } from 'lucide-react'

// NavItem represents a settings navigation item.
interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

// navItems defines the settings sidebar navigation items.
const navItems: NavItem[] = [
  { to: '/settings/account', icon: User, label: '账户' },
  { to: '/settings/contents', icon: FileText, label: '我的内容' },
  { to: '/settings/favorites', icon: Bookmark, label: '我的收藏' },
  { to: '/settings/security', icon: Shield, label: '安全设置' },
  { to: '/settings/notifications', icon: Bell, label: '通知设置' },
]

// SettingsLayout provides a sidebar navigation for user settings pages.
function SettingsLayout() {
  const location = useLocation()

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 sticky top-14 overflow-y-auto bg-white"
        style={{ width: 240, height: 'calc(100vh - 56px)' }}
      >
        <div className="flex flex-col h-full">
          {/* Title */}
          <div className="px-6 py-4">
            <h2 className="text-base font-semibold" style={{ color: '#0f0f0f' }}>个人设置</h2>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl no-underline transition-colors ${
                    location.pathname === item.to ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                  }`
                }
                style={{ color: '#0f0f0f' }}
              >
                <item.icon size={20} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Back to home */}
          <div className="px-3 pb-3">
            <NavLink
              to="/"
              className="flex items-center gap-3 px-3 py-2 rounded-xl no-underline transition-colors hover:bg-black/5"
              style={{ color: '#0f0f0f' }}
            >
              <ArrowLeft size={20} />
              <span className="text-sm">返回首页</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  )
}

export default SettingsLayout
