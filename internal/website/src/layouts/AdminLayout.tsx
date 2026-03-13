import { Outlet, NavLink, Navigate } from 'react-router-dom'
import { Avatar, DropdownMenu } from '@radix-ui/themes'
import { FileText, Users, ArrowLeft, LogOut } from 'lucide-react'

import { useAppContext } from 'src/context/app'

// AdminLayout provides the admin panel layout with sidebar navigation.
function AdminLayout() {
  const { currentUser } = useAppContext()

  // Require admin role
  if (!currentUser || currentUser.role !== 'admin') {
    return <Navigate to="/forbidden" replace />
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col flex-shrink-0">
        <div className="h-16 px-5 flex items-center border-b border-gray-700">
          <NavLink to="/" className="text-lg font-bold text-white no-underline">
            Niubility
          </NavLink>
          <span className="ml-2 text-xs text-gray-400">管理后台</span>
        </div>

        <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
          <NavLink
            to="/admin/contents"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm no-underline transition-colors ${
                isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <FileText size={18} />
            内容管理
          </NavLink>
          <NavLink
            to="/admin/users"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm no-underline transition-colors ${
                isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Users size={18} />
            用户管理
          </NavLink>
        </nav>

        <div className="px-3 pb-4">
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white no-underline transition-colors"
          >
            <ArrowLeft size={18} />
            返回前台
          </NavLink>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-end">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              <button className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-1 rounded-full hover:bg-gray-100">
                <Avatar
                  size="2"
                  radius="full"
                  src={currentUser.avatar}
                  fallback={currentUser.name?.charAt(0) || currentUser.username.charAt(0)}
                />
                <span className="text-sm text-gray-700">{currentUser.name || currentUser.username}</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
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

        <main className="flex-1 p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
