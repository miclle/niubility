import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, Link, useLocation, useParams } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut, Settings, User, Search, Menu, Home, Play, FileText, ChevronDown, Plus, ServerOff, BookOpen, GraduationCap, Heart, Star, Lightbulb, Trophy, Coffee, Briefcase, Globe, Flame, CircleUserRound, UserCheck, ImageIcon, type LucideIcon } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import { contentNewPath } from 'src/lib/content-url'
import type { ContentType } from 'src/types/content'

// iconMap maps icon name strings to Lucide icon components.
const iconMap: Record<string, LucideIcon> = {
  Home,
  Play,
  FileText,
  BookOpen,
  GraduationCap,
  Heart,
  Star,
  Lightbulb,
  Trophy,
  Coffee,
  Briefcase,
  Globe,
  Flame,
}

// MainLayout provides YouTube-style layout with top nav and left sidebar.
function MainLayout() {
  const { initialized, currentUser, categories } = useAppContext()
  const location = useLocation()
  const { slug } = useParams()

  // Filter state managed in layout, passed to child via outlet context
  const [keyword, setKeyword] = useState('')
  const [searchValue, setSearchValue] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Remember user's manual sidebar state before auto-hide on detail page
  const userSidebarStateRef = useRef(false)

  // Detect if on detail page, editor page, or settings page (sidebar should be hidden)
  const isDetailPage = /^\/(watch|gallery|article)\/[^/]+$/.test(location.pathname)
  const isEditorPage = /^\/(watch|gallery|article)\/(new|[^/]+\/edit)$/.test(location.pathname)
  const isSettingsPage = location.pathname.startsWith('/settings')
  const shouldHideSidebar = isDetailPage || isEditorPage || isSettingsPage

  // Auto-hide sidebar on detail/settings page, restore user's state on other pages
  useEffect(() => {
    if (shouldHideSidebar) {
      // Save current state before auto-hide
      userSidebarStateRef.current = sidebarCollapsed
      setSidebarCollapsed(true)
    } else {
      // Restore user's saved state
      setSidebarCollapsed(userSidebarStateRef.current)
    }
  }, [shouldHideSidebar]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // If system is not initialized, show prompt instead of normal content
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f8f8f8' }}>
        <div className="text-center px-8 py-10 rounded-2xl bg-white" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5" style={{ background: '#f2f2f2' }}>
            <ServerOff size={28} style={{ color: '#909090' }} />
          </div>
          <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0f0f0f' }}>Niubility</h1>
          <p className="text-sm mb-1" style={{ color: '#606060' }}>系统尚未初始化</p>
          <p className="text-xs" style={{ color: '#909090' }}>请联系管理员完成初始设置</p>
        </div>
      </div>
    )
  }

  // Derive category from URL params or path (ignore @username profile routes)
  // On homepage (/), category is empty to show all content
  const isHome = location.pathname === '/'
  const category: string = isHome ? '' : ((slug && !slug.startsWith('@') ? slug : '') || location.pathname.split('/')[1] || '')

  // Derive type filter from URL search params
  const searchParams = new URLSearchParams(location.search)
  const typeFilter = (searchParams.get('type') || '') as ContentType | ''

  const handleSearch = () => {
    setKeyword(searchValue)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Build type filter path for a given content type
  const typeFilterPath = (type: ContentType | '') => {
    if (!category) return type ? `/?type=${type}` : '/'
    return type ? `/${category}?type=${type}` : `/${category}`
  }

  // Render type filter nav items
  const renderTypeFilterNav = () => (
    <div className="px-3">
      <div className="flex items-center justify-between px-3 py-1 mb-1 cursor-pointer">
        <span className="text-sm font-medium" style={{ color: '#0f0f0f' }}>类型筛选</span>
        <ChevronDown size={16} style={{ color: '#0f0f0f' }} />
      </div>
      <NavLink
        to={typeFilterPath('')}
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === '' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <FileText size={24} />
        <span className="text-sm">全部</span>
      </NavLink>
      <NavLink
        to={typeFilterPath('video')}
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'video' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <Play size={24} />
        <span className="text-sm">视频</span>
      </NavLink>
      <NavLink
        to={typeFilterPath('gallery')}
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'gallery' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <ImageIcon size={24} />
        <span className="text-sm">图文</span>
      </NavLink>
      <NavLink
        to={typeFilterPath('article')}
        className={`flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${typeFilter === 'article' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'}`}
        style={{ color: '#0f0f0f' }}
      >
        <FileText size={24} />
        <span className="text-sm">长文</span>
      </NavLink>
    </div>
  )

  // Render category nav items
  const renderCategoryNav = () => (
    <div className="px-3">
      <NavLink
        to="/"
        end
        className={() =>
          `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
            isHome ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
          }`
        }
        style={{ color: '#0f0f0f' }}
      >
        <Home size={24} />
        <span className="text-sm">首页</span>
      </NavLink>
      {currentUser && (
        <NavLink
          to="/following"
          className={() =>
            `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
              location.pathname === '/following' ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
            }`
          }
          style={{ color: '#0f0f0f' }}
        >
          <UserCheck size={24} />
          <span className="text-sm">关注</span>
        </NavLink>
      )}
      {categories.map((cat) => {
        const IconComponent = iconMap[cat.icon] || Home
        return (
          <NavLink
            key={cat.slug}
            to={`/${cat.slug}`}
            className={() =>
              `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                category === cat.slug ? 'bg-black/10 font-medium' : 'hover:bg-black/5'
              }`
            }
            style={{ color: '#0f0f0f' }}
          >
            <IconComponent size={24} />
            <span className="text-sm">{cat.name}</span>
          </NavLink>
        )
      })}
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top Navigation - YouTube style */}
      <header className="sticky top-0 z-50 h-14 bg-white flex items-center justify-between px-4">
        {/* Left: Menu + Logo */}
        <div className="flex items-center gap-4">
          <button
            className="yt-icon-btn"
            onClick={() => {
              if (shouldHideSidebar) {
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
                    图文
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link to={contentNewPath('article')} />}>
                    <FileText size={16} />
                    长文
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                <DropdownMenuItem render={<Link to={`/@${currentUser.username}`} />}>
                  <CircleUserRound size={16} />
                  个人主页
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/settings/account" />}>
                  <User size={16} />
                  个人设置
                </DropdownMenuItem>
                {(currentUser.role === 'admin' || currentUser.role === 'super_admin') && (
                  <DropdownMenuItem render={<Link to="/admin" />}>
                    <Settings size={16} />
                    管理后台
                  </DropdownMenuItem>
                )}
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
        {/* Drawer overlay for detail/settings page */}
        {shouldHideSidebar && (
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
              <nav className="py-3 overflow-y-auto flex flex-col" style={{ height: 'calc(100% - 56px)' }}>
                {/* Main navigation */}
                {renderCategoryNav()}

                {/* Divider */}
                <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />

                {/* Type filter */}
                {renderTypeFilterNav()}

                <div className="mt-auto px-6 py-4 text-xs" style={{ color: '#909090' }}>
                  &copy; {new Date().getFullYear()} Niubility
                </div>
              </nav>
            </aside>
          </>
        )}

        {/* Sidebar - YouTube style (hidden on detail/settings page) */}
        {!shouldHideSidebar && (
          <aside
            className="flex-shrink-0 sticky top-14 overflow-y-auto bg-white transition-all duration-200"
            style={{
              width: sidebarCollapsed ? 0 : 240,
              height: 'calc(100vh - 56px)',
              overflowX: 'hidden',
            }}
          >
            <nav className="py-3 flex flex-col" style={{ width: 240, minHeight: '100%' }}>
              {/* Main navigation */}
              {renderCategoryNav()}

              {/* Divider */}
              <div className="my-3 mx-3 h-px" style={{ background: '#e5e5e5' }} />

              {/* Type filter */}
              {renderTypeFilterNav()}

              <div className="mt-auto px-6 py-4 text-xs" style={{ color: '#909090' }}>
                &copy; {new Date().getFullYear()} Niubility
              </div>
            </nav>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 bg-white">
          <Outlet context={{ keyword, typeFilter, category }} />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
