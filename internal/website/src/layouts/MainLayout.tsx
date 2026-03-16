import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut, Settings, User, Search, Menu, Home, Play, FileText, ChevronDown, Plus } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import type { ContentType, ContentCategory } from 'src/types/content'

// MainLayout provides YouTube-style layout with top nav and left sidebar.
function MainLayout() {
  const { initialized, currentUser } = useAppContext()
  const navigate = useNavigate()
  const location = useLocation()

  // If system is not initialized, show prompt instead of normal content
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm" style={{ color: '#606060' }}>系统尚未初始化，请联系管理员完成初始设置</p>
        </div>
      </div>
    )
  }

  // Filter state managed in layout, passed to child via outlet context
  const [keyword, setKeyword] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [typeFilter, setTypeFilter] = useState<ContentType | ''>('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Remember user's manual sidebar state before auto-hide on detail page
  const userSidebarStateRef = useRef(false)

  // Detect if on detail page
  const isDetailPage = /^\/contents\/[^/]+$/.test(location.pathname)

  // Auto-hide sidebar on detail page, restore user's state on other pages
  useEffect(() => {
    if (isDetailPage) {
      // Save current state before auto-hide
      userSidebarStateRef.current = sidebarCollapsed
      setSidebarCollapsed(true)
    } else {
      // Restore user's saved state
      setSidebarCollapsed(userSidebarStateRef.current)
    }
  }, [isDetailPage])

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Derive category from current path
  const category: ContentCategory = location.pathname === '/culture' ? 'culture' : 'learning'

  const handleSearch = () => {
    setKeyword(searchValue)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top Navigation - YouTube style */}
      <header className="sticky top-0 z-50 h-14 bg-white flex items-center justify-between px-4">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-4">
          <button
            className="yt-icon-btn"
            onClick={() => {
              if (isDetailPage) {
                setDrawerOpen(!drawerOpen)
              } else {
                setSidebarCollapsed(!sidebarCollapsed)
              }
            }}
          >
            <Menu size={24} style={{ color: '#0f0f0f' }} />
          </button>
          <NavLink to="/" className="flex items-center gap-1 no-underline">
            <span className="text-xl font-semibold" style={{ color: '#0f0f0f', letterSpacing: '-0.5px' }}>
              Niubility
            </span>
          </NavLink>
        </div>

        {/* Center: Search box - YouTube style */}
        <div className="yt-search-box">
          <input
            type="text"
            placeholder="搜索"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="yt-search-input"
          />
          <button className="yt-search-btn" onClick={handleSearch}>
            <Search size={20} style={{ color: '#0f0f0f' }} />
          </button>
        </div>

        {/* Right: Create button + User menu */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <>
              <NavLink
                to="/contents/new"
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium no-underline transition-colors"
                style={{
                  background: '#0f0f0f',
                  color: '#ffffff',
                }}
              >
                <Plus size={16} />
                创建
              </NavLink>
              <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="p-1 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer border-0 bg-transparent">
                    <Avatar>
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name || currentUser.username} />
                      <AvatarFallback>{currentUser.name?.charAt(0) || currentUser.username.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>
                  {currentUser.name || currentUser.username}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    <Settings size={16} />
                    管理后台
                  </DropdownMenuItem>
                )}
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
            </>
          ) : (
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium no-underline"
              style={{
                borderColor: '#065fd4',
                color: '#065fd4',
                background: 'transparent',
                border: '1px solid #065fd4',
              }}
            >
              <User size={16} />
              登录
            </a>
          )}
        </div>
      </header>

      {/* Body: Sidebar + Main Content */}
      <div className="flex flex-1">
        {/* Drawer overlay for detail page */}
        {isDetailPage && (
          <>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 z-[55] transition-opacity duration-300 ${
                drawerOpen ? 'bg-black/50 opacity-100' : 'bg-black/50 opacity-0 pointer-events-none'
              }`}
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer */}
            <aside
              className={`fixed left-0 top-0 z-[60] h-screen w-60 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
                drawerOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex items-center gap-4 h-14 px-4 border-b" style={{ borderColor: '#e5e5e5' }}>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="yt-icon-btn"
                >
                  <Menu size={24} style={{ color: '#0f0f0f' }} />
                </button>
                <span className="text-xl font-semibold" style={{ color: '#0f0f0f', letterSpacing: '-0.5px' }}>
                  Niubility
                </span>
              </div>
              <nav className="py-3 overflow-y-auto" style={{ height: 'calc(100% - 56px)' }}>
                {/* Main navigation */}
                <div className="px-3">
                  <NavLink
                    to="/learning"
                    className={({ isActive }) =>
                      `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                        isActive && category === 'learning'
                          ? 'bg-black/10 font-medium'
                          : 'hover:bg-black/5'
                      }`
                    }
                    style={({ isActive }) => ({
                      color: isActive && category === 'learning' ? '#0f0f0f' : '#0f0f0f',
                    })}
                  >
                    <Home size={24} />
                    <span className="text-sm">学习交流</span>
                  </NavLink>
                  <NavLink
                    to="/culture"
                    className={({ isActive }) =>
                      `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                        isActive && category === 'culture'
                          ? 'bg-black/10 font-medium'
                          : 'hover:bg-black/5'
                      }`
                    }
                    style={({ isActive }) => ({
                      color: isActive && category === 'culture' ? '#0f0f0f' : '#0f0f0f',
                    })}
                  >
                    <Play size={24} />
                    <span className="text-sm">企业文化</span>
                  </NavLink>
                </div>

                {/* Divider */}
                <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />

                {/* Type filter */}
                <div className="px-3">
                  <div className="flex items-center justify-between px-3 py-1 mb-1 cursor-pointer">
                    <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
                      类型筛选
                    </span>
                    <ChevronDown size={16} style={{ color: '#0f0f0f' }} />
                  </div>
                  <button
                    onClick={() => setTypeFilter('')}
                    className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                      typeFilter === '' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                    }`}
                    style={{ color: '#0f0f0f' }}
                  >
                    <FileText size={24} />
                    <span className="text-sm">全部</span>
                  </button>
                  <button
                    onClick={() => setTypeFilter('article')}
                    className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                      typeFilter === 'article' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                    }`}
                    style={{ color: '#0f0f0f' }}
                  >
                    <FileText size={24} />
                    <span className="text-sm">图文</span>
                  </button>
                  <button
                    onClick={() => setTypeFilter('video')}
                    className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                      typeFilter === 'video' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                    }`}
                    style={{ color: '#0f0f0f' }}
                  >
                    <Play size={24} />
                    <span className="text-sm">视频</span>
                  </button>
                </div>
              </nav>
            </aside>
          </>
        )}

        {/* Sidebar - YouTube style (hidden on detail page) */}
        {!isDetailPage && (
          <aside
            className="flex-shrink-0 sticky top-14 overflow-y-auto bg-white transition-all duration-200"
            style={{
              width: sidebarCollapsed ? 0 : 240,
              height: 'calc(100vh - 56px)',
              overflowX: 'hidden',
            }}
          >
            <nav className="py-3" style={{ width: 240 }}>
              {/* Main navigation */}
              <div className="px-3">
                <NavLink
                  to="/learning"
                  className={({ isActive }) =>
                    `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                      isActive && category === 'learning'
                        ? 'bg-black/10 font-medium'
                        : 'hover:bg-black/5'
                    }`
                  }
                  style={({ isActive }) => ({
                    color: isActive && category === 'learning' ? '#0f0f0f' : '#0f0f0f',
                  })}
                >
                  <Home size={24} />
                  <span className="text-sm">学习交流</span>
                </NavLink>
                <NavLink
                  to="/culture"
                  className={({ isActive }) =>
                    `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                      isActive && category === 'culture'
                        ? 'bg-black/10 font-medium'
                        : 'hover:bg-black/5'
                    }`
                  }
                  style={({ isActive }) => ({
                    color: isActive && category === 'culture' ? '#0f0f0f' : '#0f0f0f',
                  })}
                >
                  <Play size={24} />
                  <span className="text-sm">企业文化</span>
                </NavLink>
              </div>

              {/* Divider */}
              <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />

              {/* Type filter */}
              <div className="px-3">
                <div className="flex items-center justify-between px-3 py-1 mb-1 cursor-pointer">
                  <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>
                    类型筛选
                  </span>
                  <ChevronDown size={16} style={{ color: '#0f0f0f' }} />
                </div>
                <button
                  onClick={() => setTypeFilter('')}
                  className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                    typeFilter === '' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                  }`}
                  style={{ color: '#0f0f0f' }}
                >
                  <FileText size={24} />
                  <span className="text-sm">全部</span>
                </button>
                <button
                  onClick={() => setTypeFilter('article')}
                  className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                    typeFilter === 'article' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                  }`}
                  style={{ color: '#0f0f0f' }}
                >
                  <FileText size={24} />
                  <span className="text-sm">图文</span>
                </button>
                <button
                  onClick={() => setTypeFilter('video')}
                  className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                    typeFilter === 'video' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
                  }`}
                  style={{ color: '#0f0f0f' }}
                >
                  <Play size={24} />
                  <span className="text-sm">视频</span>
                </button>
              </div>
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 bg-white">
          <Outlet context={{ keyword, typeFilter, category }} />

          {/* Footer */}
          <footer className="py-4 text-center text-xs" style={{ color: '#909090', borderTop: '1px solid #e5e5e5' }}>
            &copy; {new Date().getFullYear()} Niubility
          </footer>
        </main>
      </div>
    </div>
  )
}

export default MainLayout
