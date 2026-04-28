import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Search, Menu, User, ServerOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useAppContext } from 'src/context/app'
import { useSiteHead } from 'src/hooks/useSiteHead'
import { siteResourceURL } from 'src/api/upload'
import type { ContentType } from 'src/types/content'

import SidebarNav from './SidebarNav'
import CreateMenu from './CreateMenu'
import UserMenu from './UserMenu'

// MainLayout provides YouTube-style layout with top nav and left sidebar.
function MainLayout() {
  const { t } = useTranslation('nav')
  const { initialized, currentUser, categories, siteConfig } = useAppContext()
    const location = useLocation()

    // Apply site config to document head
    useSiteHead(siteConfig)

    // Derived values from site config
    const siteTitle = siteConfig?.title || 'Niubility'
    const siteLogoUrl = siteConfig?.logo_url ? siteResourceURL(siteConfig.logo_url) : null
    const siteVersion = siteConfig?.version?.trim() || ''
    const copyright = siteConfig?.copyright || 'Niubility'
    const footerContent = siteConfig?.footer || `© ${new Date().getFullYear()} ${copyright}`

    // Filter state managed in layout, passed to child via outlet context
    const [keyword, setKeyword] = useState('')
    const [searchValue, setSearchValue] = useState('')
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [drawerOpen, setDrawerOpen] = useState(false)

    // Remember user's manual sidebar state before auto-hide on detail page
    const userSidebarStateRef = useRef(false)

    // Detect if on detail page, editor page, or settings page (sidebar should be hidden)
    const isDetailPage = /^\/(video|gallery|article|podcast)\/[^/]+$/.test(location.pathname)
    const isEditorPage = /^\/(video|gallery|article|podcast)\/(new|[^/]+\/edit)$/.test(location.pathname)
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
            <div className="app-surface min-h-screen flex items-center justify-center px-4">
                <div className="app-panel text-center px-8 py-10 rounded-2xl">
                    <div className="app-surface-muted inline-flex items-center justify-center w-14 h-14 rounded-full mb-5">
                        <ServerOff size={28} className="app-text-tertiary" />
                    </div>
                    <h1 className="text-2xl font-semibold mb-2 text-foreground">Niubility</h1>
                    <p className="app-text-secondary text-sm mb-1">{t('nav:notInitialized')}</p>
                    <p className="app-text-tertiary text-xs">{t('nav:contactAdmin')}</p>
                </div>
            </div>
        )
    }
    // Derive category and type from URL path only (sidebar highlighting + base filter)
    const isPublicContentsRoute = location.pathname === '/contents'
    const isHome = location.pathname === '/' || isPublicContentsRoute
    const typeRouteMap: Record<string, ContentType> = { videos: 'video', galleries: 'gallery', articles: 'article', podcasts: 'podcast' }
    const firstSegment = location.pathname.split('/')[1] || ''
    const isTypeRoute = firstSegment in typeRouteMap
    const category: string = (!isHome && !isTypeRoute && !firstSegment.startsWith('@')) ? firstSegment : ''
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
        <div className="app-surface flex flex-col min-h-screen">
            {/* Top Navigation */}
            <header className="app-surface sticky top-0 z-50 h-14 flex items-center justify-between px-4 border-b app-border">
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
                        <Menu size={24} className="text-foreground" />
                    </button>
                    <NavLink to="/" className="flex items-center gap-1 no-underline">
                        {siteLogoUrl ? (
                            <img src={siteLogoUrl} alt={siteTitle} className="h-6 object-contain" />
                        ) : (
                            <span className="text-xl font-semibold text-foreground" style={{ letterSpacing: '-0.5px' }}>
                                {siteTitle}
                            </span>
                        )}
                    </NavLink>
                </div>
                {/* Center: Search box */}
                <div className="yt-search-box">
                    <input
                        type="text"
                        placeholder={t('nav:search')}
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        className="yt-search-input"
                    />
                    <button className="yt-search-btn" onClick={handleSearch}>
                        <Search size={20} className="text-foreground" />
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
                                borderColor: 'var(--brand)',
                                color: 'var(--brand)',
                                background: 'transparent',
                                border: '1px solid var(--brand)',
                            }}
                        >
                            <User size={16} />
                            {t('nav:signIn')}
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
                            className={`app-surface-elevated fixed left-0 top-0 z-[60] h-screen w-60 shadow-xl transform transition-transform duration-300 ease-in-out ${
                                drawerOpen ? 'translate-x-0' : '-translate-x-full'
                            }`}
                        >
                            <div className="flex items-center gap-4 h-14 px-4 border-b app-border">
                                <button
                                    onClick={() => setDrawerOpen(false)}
                                    className="yt-icon-btn"
                                >
                                    <Menu size={24} className="text-foreground" />
                                </button>
                                {siteLogoUrl ? (
                                    <img src={siteLogoUrl} alt={siteTitle} className="h-6 object-contain" />
                                ) : (
                                    <span className="text-xl font-semibold text-foreground" style={{ letterSpacing: '-0.5px' }}>
                                        {siteTitle}
                                    </span>
                                )}
                            </div>
                            <SidebarNav {...sidebarNavProps} />
                        </aside>
                    </>
                )}
                {/* Sidebar (hidden on detail/settings page) */}
                {!shouldHideSidebar && (
                    <aside
                        className="app-surface flex-shrink-0 sticky top-14 overflow-y-auto transition-all duration-200"
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
                <main className="app-surface flex-1 min-w-0 flex flex-col">
                    <div className="flex-1">
                        <Outlet context={{ keyword, typeFilter, category }} />
                    </div>
                    {/* Footer */}
                    <footer className="py-4 px-6 border-t app-border">
                        <div className="app-text-tertiary flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
                            <div dangerouslySetInnerHTML={{ __html: footerContent }} />
                            {siteVersion && (
                                <span className="app-surface-muted app-text-secondary inline-flex items-center rounded-full px-2 py-0.5 text-[11px]">
                                    {siteVersion}
                                </span>
                            )}
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    )
}
export default MainLayout
