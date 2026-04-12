import { useState } from "react";
import { Outlet, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Users,
  ArrowLeft,
  LogOut,
  Settings,
  Menu,
  FolderOpen,
  ChevronDown,
  UserPlus,
  HardDrive,
  MessageSquare,
  CircleUserRound,
  User,
  Plus,
  Play,
  ImageIcon,
  Globe2,
  Mic,
  Database,
  Server,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppContext } from "src/context/app";
import { useSiteHead } from "src/hooks/useSiteHead";
import { siteResourceURL } from "src/api/upload";
import { contentNewPath } from "src/lib/content-url";
import SiteAvatarImage from "src/components/SiteAvatarImage";
import ThemeMenuItems from "src/components/ThemeMenuItems";

// NavChild represents a sub-menu item under a parent nav item.
interface NavChild {
  to: string;
  icon: LucideIcon;
  label: string;
}

// NavItem represents a top-level navigation item, optionally with children.
interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  children?: NavChild[];
}

// AdminLayout provides the admin panel layout with collapsible sidebar navigation.
function AdminLayout() {
  const { t } = useTranslation("admin");
  const { currentUser, siteConfig } = useAppContext();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >(() => ({
    "/admin/contents": location.pathname.startsWith("/admin/contents"),
    "/admin/settings": location.pathname.startsWith("/admin/settings"),
  }));

  // Apply site config to document head
  useSiteHead(siteConfig);

  // Derived values from site config
  const siteTitle = siteConfig?.title || "Niubility";
  const siteLogoUrl = siteConfig?.logo_url
    ? siteResourceURL(siteConfig.logo_url)
    : null;

  // Require admin or super_admin role
  if (
    !currentUser ||
    (currentUser.role !== "admin" && currentUser.role !== "super_admin")
  ) {
    return <Navigate to="/forbidden" replace />;
  }

  // Nav items configuration
  const navItems: NavItem[] = [
    {
      to: "/admin/contents",
      icon: FileText,
      label: t("admin:contentManagement"),
      children: [
        { to: "/admin/contents/videos", icon: Play, label: t("admin:video") },
        {
          to: "/admin/contents/galleries",
          icon: ImageIcon,
          label: t("admin:gallery"),
        },
        {
          to: "/admin/contents/articles",
          icon: FileText,
          label: t("admin:article"),
        },
        {
          to: "/admin/contents/podcasts",
          icon: Mic,
          label: t("admin:podcast"),
        },
      ],
    },
    {
      to: "/admin/categories",
      icon: FolderOpen,
      label: t("admin:categoryManagement"),
    },
    { to: "/admin/users", icon: Users, label: t("admin:userManagement") },
    { to: "/admin/nodes", icon: Server, label: t("admin:serviceNodes") },
    {
      to: "/admin/settings",
      icon: Settings,
      label: t("admin:systemConfig"),
      children: [
        {
          to: "/admin/settings/site",
          icon: Globe2,
          label: t("admin:siteConfig"),
        },
        {
          to: "/admin/settings/auth",
          icon: UserPlus,
          label: t("admin:authConfig"),
        },
        {
          to: "/admin/settings/storage",
          icon: HardDrive,
          label: t("admin:storageConfig"),
        },
        {
          to: "/admin/settings/database-backup",
          icon: Database,
          label: t("admin:databaseBackup"),
        },
        {
          to: "/admin/settings/wechat",
          icon: MessageSquare,
          label: t("admin:wechat"),
        },
      ],
    },
  ];

  return (
    <div className="app-surface flex min-h-screen">
      {/* Sidebar - fixed, does not scroll with page */}
      <aside
        className="app-surface fixed top-0 left-0 h-screen flex flex-col transition-all duration-200 z-30"
        style={{
          width: sidebarCollapsed ? 72 : 240,
          borderRight: "1px solid var(--surface-border)",
        }}
      >
        {/* Logo */}
        <div
          className="h-14 px-4 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          <NavLink
            to="/"
            className="text-lg font-semibold no-underline flex-shrink-0"
            style={{ color: "var(--foreground)" }}
          >
            {siteLogoUrl ? (
              <img
                src={siteLogoUrl}
                alt={siteTitle}
                className="h-6 object-contain"
              />
            ) : sidebarCollapsed ? (
              siteTitle.charAt(0)
            ) : (
              siteTitle
            )}
          </NavLink>
          {!sidebarCollapsed && (
            <span className="app-text-tertiary text-xs">
              {t("admin:adminPanel")}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          {navItems.map((item) => {
            if (item.children) {
              const isSectionActive = location.pathname.startsWith(item.to);
              const isExpanded = expandedSections[item.to] ?? isSectionActive;

              // Parent item with expandable children
              return (
                <div key={item.to}>
                  {sidebarCollapsed ? (
                    // Collapsed: show as a simple link to first child
                    <NavLink
                      to={item.children[0].to}
                      className={() =>
                        `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                          isSectionActive
                            ? "app-chip font-medium"
                            : "hover:bg-[var(--surface-hover)]"
                        }`
                      }
                      style={{ color: "var(--foreground)", justifyContent: "center" }}
                    >
                      <Tooltip>
                        <TooltipTrigger render={<button type="button" />}>
                          <item.icon size={24} />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </NavLink>
                  ) : (
                    <>
                      {/* Expandable parent button */}
                      <button
                        onClick={() =>
                          setExpandedSections((prev) => ({
                            ...prev,
                            [item.to]: !isExpanded,
                          }))
                        }
                        className={`w-full flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                          isSectionActive && !isExpanded
                            ? "app-chip font-medium"
                            : "hover:bg-[var(--surface-hover)]"
                        }`}
                        style={{
                          color: "var(--foreground)",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <item.icon size={24} />
                        <span className="text-sm flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          size={16}
                          className="transition-transform duration-200"
                          style={{
                            transform: isExpanded
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                          }}
                        />
                      </button>

                      {/* Children sub-menu */}
                      {isExpanded && (
                        <div className="ml-6 mt-1 space-y-0.5">
                          {item.children.map((child) => (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-1.5 rounded-lg no-underline transition-colors text-sm ${
                                  isActive
                                    ? "app-chip font-medium"
                                    : "hover:bg-[var(--surface-hover)]"
                                }`
                              }
                              style={{ color: "var(--foreground)" }}
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
              );
            }

            // Regular nav item (no children)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors ${
                    isActive ? "app-chip font-medium" : "hover:bg-[var(--surface-hover)]"
                  }`
                }
                style={{
                  color: "var(--foreground)",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
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
            );
          })}
        </nav>

        {/* Back to front */}
        <div className="px-3 pb-3">
          <NavLink
            to="/"
            className="flex items-center gap-6 px-3 py-2 rounded-xl no-underline transition-colors hover:bg-[var(--surface-hover)]"
            style={{
              color: "var(--foreground)",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
            }}
          >
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger render={<button type="button" />}>
                  <ArrowLeft size={24} />
                </TooltipTrigger>
                <TooltipContent side="right">
                  {t("admin:backToFront")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <ArrowLeft size={24} />
                <span className="text-sm">{t("admin:backToFront")}</span>
              </>
            )}
          </NavLink>
        </div>
      </aside>

      {/* Main content - offset by sidebar width */}
      <div
        className="flex-1 min-w-0 h-screen overflow-y-auto transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
      >
        {/* Header */}
        <header
          className="app-surface sticky top-0 h-14 px-6 flex items-center justify-between z-20"
          style={{ borderBottom: "1px solid var(--surface-border)" }}
        >
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Menu size={24} style={{ color: "var(--foreground)" }} />
          </button>

          {/* Right: Create button + User menu */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    className="theme-primary-button flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border-0"
                  >
                    <Plus size={16} />
                    {t("nav:create")}
                  </button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link to={contentNewPath("video")} />}
                >
                  <Play size={16} />
                  {t("nav:video")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link to={contentNewPath("gallery")} />}
                >
                  <ImageIcon size={16} />
                  {t("nav:gallery")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={<Link to={contentNewPath("article")} />}
                >
                  <FileText size={16} />
                  {t("nav:article")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
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
        </header>

        {/* Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
