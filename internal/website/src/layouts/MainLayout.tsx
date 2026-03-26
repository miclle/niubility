import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useParams } from 'react-router-dom'
import { Search, Menu, User, ServerOff } from 'lucide-react'

import { useAppContext } from 'src/context/app'
import type { ContentType } from 'src/types/content'

import SidebarNav from './SidebarNav'
import CreateMenu from './CreateMenu'
import UserMenu from './UserMenu'

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
  const isDetailPage = /^\/(video|gallery|article)\/[^/]+$/.test(location.pathname)
  const isEditorPage = /^\/(video|gallery|article)\/(new|[^/]+\/edit)$/.test(location.pathname)
  const isSettingsPage = location.pathname.startsWith('/settings')
  const shouldHideSidebar = isDetailPage || isEditorPage || isSettingsPage

  // Auto-hide sidebar on detail/settings page, restore user's state on other pages
  useEffect(() => {
    if (shouldHideSidebar) {
      userSidebarStateRef.current = sidebarCollapsed
      setSidebarCollapsed(true)
    } else {
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

  // Derive category from URL params or path
  const isHome = location.pathname === '/'
  const typeRouteMap: Record<string, ContentType> = { videos: 'video', galleries: 'gallery', articles: 'article' }
  const firstSegment = slug || location.pathname.split('/')[1] || ''
  const isTypeRoute = firstSegment in typeRouteMap
  const category: string = (isHome || isTypeRoute) ? '' : ((slug && !slug.startsWith('@') ? slug : '') || firstSegment)

  // Derive type filter from path
  const typeFilter = (isTypeRoute ? typeRouteMap[firstSegment] : '') as ContentType | ''

  const handleSearch = () => {
    setKeyword(searchValue)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Shared props for SidebarNav
  const sidebarNavProps = {
    category,
    typeFilter,
    isHome,
    currentUser,
    categories,
    locationPathname: location.pathname,
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Top Navigation */}
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

        {/* Center: Search box */}
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
              <CreateMenu />
              <UserMenu user={currentUser} />
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
              <SidebarNav {...sidebarNavProps} />
            </aside>
          </>
        )}

        {/* Sidebar (hidden on detail/settings page) */}
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
              <SidebarNav {...sidebarNavProps} />
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
