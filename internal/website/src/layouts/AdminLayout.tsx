import { useState } from 'react'
import { Outlet, NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileText, Users, ArrowLeft, LogOut, Settings, Menu, FolderOpen, ChevronDown, UserPlus, HardDrive, MessageSquare, CircleUserRound, User, Plus, Play, ImageIcon, Globe2, type LucideIcon } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { useSiteHead } from 'src/hooks/useSiteHead'
import { siteResourceURL } from 'src/api/upload'
import { contentNewPath } from 'src/lib/content-url'

// NavChild represents a sub-menu item under a parent nav item.
interface NavChild {
  to: string
  icon: LucideIcon
  label: string
}

// NavItem represents a top-level navigation item, optionally with children.
interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  children?: NavChild[]
}

// AdminLayout provides the admin panel layout with collapsible sidebar navigation.
function AdminLayout() {
  const { currentUser, siteConfig } = useAppContext()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsExpanded, setSettingsExpanded] = useState(() => location.pathname.startsWith('/admin/settings'))

  // Apply site config to document head
  useSiteHead(siteConfig)

  // Derived values from site config
  const siteTitle = siteConfig?.title || 'Niubility'
  const siteLogoUrl = siteConfig?.logo_url ? siteResourceURL(siteConfig.logo_url) : null

  // Require admin or super_admin role
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
    return <Navigate to="/forbidden" replace />
  }

  // Nav items configuration
  const navItems: NavItem[] = [
    { to: '/admin/contents', icon: FileText, label: '内容管理' },
    { to: '/admin/categories', icon: FolderOpen, label: '分类管理' },
    { to: '/admin/users', icon: Users, label: '用户管理' },
    {
      to: '/admin/settings',
      icon: Settings,
      label: '系统配置',
      children: [
        { to: '/admin/settings/site', icon: Globe2, label: '站点配置' },
        { to: '/admin/settings/auth', icon: UserPlus, label: '认证配置' },
        { to: '/admin/settings/storage', icon: HardDrive, label: '存储配置' },
        { to: '/admin/settings/wechat', icon: MessageSquare, label: '企业微信' },
      ],
    },
  ]

  const isSettingsActive = location.pathname.startsWith('/admin/settings')

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
            {siteLogoUrl ? (
              <img src={siteLogoUrl} alt={siteTitle} className="h-6 object-contain" />
            ) : (
              sidebarCollapsed ? siteTitle.charAt(0) : siteTitle
            )}
          </NavLink>
          {!sidebarCollapsed && (
            <span className="text-xs" style={{ color: '#909090' }}>管理后台</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {navItems.map((item) => {
            if (item.children) {
              // Parent item with expandable children
              return (
                <div key={item.to}>
                  {sidebarCollapsed ? (
                    // Collapsed: show as a simple link to first child
                    <NavLink
                      to={item.children[0].to}
                      className={() =>
                        `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                          isSettingsActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                        }`
                      }
                      style={{ color: '#0f0f0f', justifyContent: 'center' }}
                    >
                      <Tooltip>
                        <TooltipTrigger render={<button type="button" />}>
                          <item.icon size={24} />
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    </NavLink>
                  ) : (
                    <>
                      {/* Expandable parent button */}
                      <button
                        onClick={() => setSettingsExpanded(!settingsExpanded)}
                        className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                          isSettingsActive && !settingsExpanded ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                        }`}
                        style={{ color: '#0f0f0f', border: 'none', background: isSettingsActive && !settingsExpanded ? 'rgba(0,0,0,0.1)' : 'transparent', cursor: 'pointer' }}
                      >
                        <item.icon size={24} />
                        <span className="text-sm flex-1 text-left">{item.label}</span>
                        <ChevronDown
                          size={16}
                          className="transition-transform duration-200"
                          style={{ transform: settingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        />
                      </button>

                      {/* Children sub-menu */}
                      {settingsExpanded && (
                        <div className="ml-6 mt-1 space-y-0.5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-1.5 rounded-lg no-underline transition-colors text-sm ${
                                  isActive ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                                }`
                              }
                              style={{ color: '#0f0f0f' }}
                            >
                              <child.icon size={16} />
                              <span>{child.label}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            }

            // Regular nav item (no children)
            return (
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
            )
          })}
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

          {/* Right: Create button + User menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0"
                    style={{ background: '#0f0f0f', color: '#ffffff' }}
                  >
                    <Plus size={16} />
                    创建
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem render={<Link to={contentNewPath('video')} />}>
                  <Play size={16} />
                  视频
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to={contentNewPath('gallery')} />}>
                  <ImageIcon size={16} />
                  图集
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to={contentNewPath('article')} />}>
                  <FileText size={16} />
                  文章
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
              <DropdownMenuItem disabled>
                {currentUser.name || currentUser.username}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link to={`/@${currentUser.username}`} />}>
                <CircleUserRound size={16} />
                个人主页
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/settings/account" />}>
                <User size={16} />
                个人设置
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          </div>
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
