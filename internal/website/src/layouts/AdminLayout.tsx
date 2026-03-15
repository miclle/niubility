import { useState } from 'react'
import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { Avatar, DropdownMenu, Tooltip } from '@radix-ui/themes'
import { FileText, Users, ArrowLeft, LogOut, Upload, RefreshCw, Settings, Building2, Menu } from 'lucide-react'

import { useAppContext } from 'src/context/app'

// AdminLayout provides the admin panel layout with collapsible sidebar navigation.
function AdminLayout() {
  const { currentUser } = useAppContext()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Require admin role
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/forbidden" replace />
  }

  // Nav items configuration
  const navItems = [
    { to: '/admin/contents', icon: FileText, label: '内容管理' },
    { to: '/admin/users', icon: Users, label: '用户管理' },
    { to: '/admin/departments', icon: Building2, label: '部门管理' },
    { to: '/admin/import', icon: Upload, label: '数据导入' },
    { to: '/admin/sync', icon: RefreshCw, label: '微信同步' },
    { to: '/admin/settings', icon: Settings, label: '系统配置' },
  ]

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar - YouTube style with collapse support */}
      <aside
        className="flex flex-col flex-shrink-0 bg-white transition-all duration-200"
        style={{
          width: sidebarCollapsed ? 72 : 240,
          borderRight: '1px solid #e5e5e5',
        }}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center gap-3" style={{ borderBottom: '1px solid #e5e5e5' }}>
          <NavLink to="/" className="text-lg font-semibold no-underline flex-shrink-0" style={{ color: '#0f0f0f' }}>
            {sidebarCollapsed ? 'N' : 'Niubility'}
          </NavLink>
          {!sidebarCollapsed && (
            <span className="text-xs" style={{ color: '#909090' }}>管理后台</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                  isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                }`
              }
              style={{ color: '#0f0f0f', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            >
              {sidebarCollapsed ? (
                <Tooltip content={item.label} side="right">
                  <item.icon size={24} />
                </Tooltip>
              ) : (
                <>
                  <item.icon size={24} />
                  <span className="text-sm">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Back to front */}
        <div className="px-3 pb-3">
          <NavLink
            to="/"
            className="flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors hover:bg-black/5"
            style={{ color: '#0f0f0f', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
          >
            {sidebarCollapsed ? (
              <Tooltip content="返回前台" side="right">
                <ArrowLeft size={24} />
              </Tooltip>
            ) : (
              <>
                <ArrowLeft size={24} />
                <span className="text-sm">返回前台</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="h-14 px-6 flex items-center justify-between bg-white"
          style={{ borderBottom: '1px solid #e5e5e5' }}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
          >
            <Menu size={24} style={{ color: '#0f0f0f' }} />
          </button>

          {/* User menu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-1 rounded-full hover:bg-black/5 transition-colors">
                <Avatar
                  size="2"
                  radius="full"
                  src={currentUser.avatar}
                  fallback={currentUser.name?.charAt(0) || currentUser.username.charAt(0)}
                  style={{ width: 32, height: 32 }}
                />
                <span className="text-sm" style={{ color: '#0f0f0f' }}>
                  {currentUser.name || currentUser.username}
                </span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" className="yt-dropdown-menu">
              <DropdownMenu.Item
                color="red"
                onSelect={() => {
                  window.location.href = '/logout?redirect=' + encodeURIComponent(window.location.pathname)
                }}
              >
                <LogOut size={16} />
                退出登录
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
