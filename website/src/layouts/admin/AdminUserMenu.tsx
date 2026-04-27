import { Link } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  LogOut,
  Plus,
  Play,
  ImageIcon,
  CircleUserRound,
  User,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { contentNewPath } from "src/lib/content-url";
import SiteAvatarImage from "src/components/SiteAvatarImage";
import ThemeMenuItems from "src/components/ThemeMenuItems";

interface AdminUserMenuProps {
  currentUser: {
    username: string;
    name?: string;
    avatar?: string;
  };
}

// AdminUserMenu renders the create-content dropdown and user avatar dropdown
// in the admin header bar.
export default function AdminUserMenu({ currentUser }: AdminUserMenuProps) {
  const { t } = useTranslation("admin");

  return (
    <div className="admin-user-menu flex items-center gap-2">
      {/* Create content dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="theme-primary-button flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0">
              <Plus size={16} />
              {t("nav:create")}
            </button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link to={contentNewPath("video")} />}>
            <Play size={16} />
            {t("nav:video")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to={contentNewPath("gallery")} />}>
            <ImageIcon size={16} />
            {t("nav:gallery")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to={contentNewPath("article")} />}>
            <FileText size={16} />
            {t("nav:article")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User avatar dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="flex items-center gap-2 cursor-pointer bg-transparent border-0 p-1 rounded-full hover:bg-[var(--surface-hover)] transition-colors">
              <Avatar className="size-8">
                <SiteAvatarImage
                  src={currentUser.avatar}
                  alt={currentUser.name || currentUser.username}
                />
                <AvatarFallback>
                  {currentUser.name?.charAt(0) ||
                    currentUser.username.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">
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
          <DropdownMenuItem
            render={<Link to={`/@${currentUser.username}`} />}
          >
            <CircleUserRound size={16} />
            {t("nav:profile")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/settings/account" />}>
            <User size={16} />
            {t("nav:settings")}
          </DropdownMenuItem>
          <ThemeMenuItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              window.location.href =
                "/logout?redirect=" +
                encodeURIComponent(window.location.pathname);
            }}
          >
            <LogOut size={16} />
            {t("nav:logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
