import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { User, FileText, Shield, Bell, ArrowLeft, Bookmark, MessageSquare, Heart, History, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'

import { avatarURL as resolveAvatarURL } from 'src/api/upload'
import SiteAvatarImage from 'src/components/SiteAvatarImage'
import { useAppContext } from 'src/context/app'

// NavItem represents a settings navigation item.
interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

// SettingsLayout provides a sidebar navigation for user settings pages.
function SettingsLayout() {
  const { t } = useTranslation('settings')
  const location = useLocation()
  const { currentUser } = useAppContext()

  const navItems: NavItem[] = [
    { to: '/settings/account', icon: User, label: t('settings:accountSettingsTitle') },
    { to: '/settings/contents', icon: FileText, label: t('settings:myContents') },
    { to: '/settings/favorites', icon: Bookmark, label: t('settings:myFavorites') },
    { to: '/settings/views', icon: History, label: t('settings:myViews') },
    { to: '/settings/likes', icon: Heart, label: t('settings:myLikes') },
    { to: '/settings/comments', icon: MessageSquare, label: t('settings:myComments') },
    { to: '/settings/security', icon: Shield, label: t('settings:security') },
    { to: '/settings/notifications', icon: Bell, label: t('settings:notifications') },
  ]

  const displayName = currentUser?.name || currentUser?.username || t('settings:accountSettings')
  const avatarURL = currentUser?.avatar ? resolveAvatarURL(currentUser.avatar) : ''

  return (
    <div className="app-surface min-h-[calc(100vh-56px)] border-t app-border md:flex">
      <aside
        className="app-surface shrink-0 border-b app-border md:sticky md:top-14 md:h-[calc(100vh-56px)] md:w-[240px] md:overflow-y-auto md:border-r md:border-b-0"
      >
        <div className="flex h-full flex-col">
          <div className="border-b app-border px-6 py-10 text-center">
            <div className="flex flex-col items-center">
              <Avatar className="h-24 w-24 shrink-0 md:h-28 md:w-28">
                <SiteAvatarImage src={avatarURL} alt={displayName} />
                <AvatarFallback className="text-2xl font-semibold">
                  {displayName.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="mt-5 min-w-0">
                <h2 className="text-2xl font-semibold leading-tight text-foreground">
                  {displayName}
                </h2>
                {currentUser?.username && (
                  <p className="app-text-secondary mt-2 truncate text-sm">
                    @{currentUser.username}
                  </p>
                )}
              </div>
            </div>
          </div>

          <nav className="flex-1 px-4 py-4">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() =>
                  `mb-1 flex items-center gap-4 rounded-xl px-3 py-2 no-underline transition-colors ${
                    location.pathname === item.to ? 'app-chip font-semibold' : 'hover:bg-[var(--surface-hover)]'
                  }`
                }
                style={{ color: 'var(--foreground)' }}
              >
                <item.icon size={22} />
                <span className="text-sm">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto border-t app-border px-4 py-4">
            <NavLink
              to="/"
              className="flex items-center gap-4 rounded-xl px-3 py-2 no-underline transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: 'var(--foreground)' }}
            >
              <ArrowLeft size={22} />
              <span className="text-sm">{t('settings:backToHome')}</span>
            </NavLink>
          </div>
        </div>
      </aside>

      <main className="app-surface min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}

export default SettingsLayout
