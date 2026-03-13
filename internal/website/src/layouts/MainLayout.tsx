import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { Avatar, DropdownMenu, Button } from '@radix-ui/themes'
import { LogOut, Settings, User } from 'lucide-react'

import { useAppContext } from 'src/context/app'

// MainLayout provides the frontend layout with header tabs and user menu.
function MainLayout() {
  const { currentUser } = useAppContext()
  const navigate = useNavigate()

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/" className="text-xl font-bold text-gray-900 no-underline">
            Niubility
          </NavLink>

          {/* Tab navigation */}
          <nav className="flex gap-1">
            <NavLink
              to="/learning"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium no-underline transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              学习交流
            </NavLink>
            <NavLink
              to="/culture"
              className={({ isActive }) =>
                `px-4 py-2 rounded-md text-sm font-medium no-underline transition-colors ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              企业文化
            </NavLink>
          </nav>

          {/* User menu */}
          {currentUser ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <button className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-1 rounded-full hover:bg-gray-100">
                  <Avatar
                    size="2"
                    radius="full"
                    src={currentUser.avatar}
                    fallback={currentUser.name?.charAt(0) || currentUser.username.charAt(0)}
                  />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Item disabled>
                  <User size={16} />
                  {currentUser.name || currentUser.username}
                </DropdownMenu.Item>
                <DropdownMenu.Separator />
                {currentUser.role === 'admin' && (
                  <DropdownMenu.Item onSelect={() => navigate('/admin')}>
                    <Settings size={16} />
                    管理后台
                  </DropdownMenu.Item>
                )}
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
          ) : (
            <Button variant="outline" size="2" asChild>
              <a href={'/sso?redirect=' + encodeURIComponent(window.location.pathname)}>登录</a>
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        &copy; {new Date().getFullYear()} Niubility
      </footer>
    </div>
  )
}

export default MainLayout
