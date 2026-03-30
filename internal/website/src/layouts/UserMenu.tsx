import { Link } from 'react-router-dom'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LogOut, Settings, User, CircleUserRound } from 'lucide-react'

import SiteAvatarImage from 'src/components/SiteAvatarImage'
import type { User as UserType } from 'src/types/user'

// UserMenuProps defines the props for UserMenu component.
interface UserMenuProps {
  user: UserType
}

// UserMenu renders the user dropdown menu.
export default function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="p-1 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer border-0 bg-transparent">
            <Avatar>
              <SiteAvatarImage src={user.avatar} alt={user.name || user.username} />
              <AvatarFallback>{user.name?.charAt(0) || user.username.charAt(0)}</AvatarFallback>
            </Avatar>
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>
          {user.name || user.username}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to={`/@${user.username}`} />}>
          <CircleUserRound size={16} />
          个人主页
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/settings/account" />}>
          <User size={16} />
          个人设置
        </DropdownMenuItem>
        {(user.role === 'admin' || user.role === 'super_admin') && (
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
  )
}
