import { useState } from 'react'
import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, Users, ArrowLeft, LogOut, Upload, RefreshCw, Settings, Menu, FolderOpen } from 'lucide-react'

import { useAppContext } from 'src/context/app'

// AdminLayout provides the admin panel layout with collapsible sidebar navigation.
function AdminLayout() {
  const { currentUser } = useAppContext()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Require admin or super_admin role
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return <Navigate to="/forbidden" replace />
  }

  // Nav items configuration
  const navItems = [
    { to: '/admin/contents', icon: FileText, label: '内容管理' },
    { to: '/admin/categories', icon: FolderOpen, label: '分类管理' },
    { to: '/admin/users', icon: Users, label: '用户管理' },
    { to: '/admin/import', icon: Upload, label: '数据导入' },
    { to: '/admin/sync', icon: RefreshCw, label: '微信同步' },
    { to: '/admin/settings', icon: Settings, label: '系统配置' },
  ]

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar - fixed, does not scroll with page */}
      <aside
        className="fixed top-0 left-0 h-screen flex flex-col bg-white transition-all duration-200 z-30"
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
                <Tooltip>
                  <TooltipTrigger render={<button type="button" />}>
                    <item.icon size={24} />
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
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
              <Tooltip>
                <TooltipTrigger render={<button type="button" />}>
                  <ArrowLeft size={24} />
                </TooltipTrigger>
                <TooltipContent side="right">返回前台</TooltipContent>
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

      {/* Main content - offset by sidebar width */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto transition-all duration-200" style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}>
        {/* Header */}
        <header
          className="sticky top-0 h-14 px-6 flex items-center justify-between bg-white z-20"
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-1 rounded-full hover:bg-black/5 transition-colors">
                  <Avatar className="size-8">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name || currentUser.username} />
                    <AvatarFallback>{currentUser.name?.charAt(0) || currentUser.username.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm" style={{ color: '#0f0f0f' }}>
                    {currentUser.name || currentUser.username}
                  </span>
                </button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  window.location.href = '/logout?redirect=' + encodeURIComponent(window.location.pathname)
                }}
              >
                <LogOut size={16} />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
