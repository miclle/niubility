import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { Avatar, DropdownMenu } from '@radix-ui/themes'
import { FileText, Users, ArrowLeft, LogOut, Upload, RefreshCw, Settings, Building2 } from 'lucide-react'

import { useAppContext } from 'src/context/app'

// AdminLayout provides the admin panel layout with YouTube-style sidebar navigation.
function AdminLayout() {
  const { currentUser } = useAppContext()

  // Require admin role
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/forbidden" replace />
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar - YouTube style */}
      <aside
        className="flex flex-col flex-shrink-0 bg-white"
        style={{
          width: 240,
          borderRight: '1px solid #e5e5e5',
        }}
      >
        {/* Logo */}
        <div className="h-14 px-4 flex items-center" style={{ borderBottom: '1px solid #e5e5e5' }}>
          <NavLink to="/" className="text-lg font-semibold no-underline" style={{ color: '#0f0f0f' }}>
            Niubility
          </NavLink>
          <span className="ml-2 text-xs" style={{ color: '#909090' }}>管理后台</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3">
          <NavLink
            to="/admin/contents"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <FileText size={24} />
            <span className="text-sm">内容管理</span>
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <Users size={24} />
            <span className="text-sm">用户管理</span>
          </NavLink>
          <NavLink
            to="/admin/departments"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <Building2 size={24} />
            <span className="text-sm">部门管理</span>
          </NavLink>
          <NavLink
            to="/admin/import"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <Upload size={24} />
            <span className="text-sm">数据导入</span>
          </NavLink>
          <NavLink
            to="/admin/sync"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <RefreshCw size={24} />
            <span className="text-sm">微信同步</span>
          </NavLink>
          <NavLink
            to="/admin/settings"
            className={({ isActive }) =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <Settings size={24} />
            <span className="text-sm">系统配置</span>
          </NavLink>
        </nav>

        {/* Back to front */}
        <div className="px-3 pb-3">
          <NavLink
            to="/"
            className="flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors hover:bg-black/5"
            style={{ color: '#0f0f0f' }}
          >
            <ArrowLeft size={24} />
            <span className="text-sm">返回前台</span>
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header
          className="h-14 px-6 flex items-center justify-end bg-white"
          style={{ borderBottom: '1px solid #e5e5e5' }}
        >
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
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
