import { useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import {
  FileText,
  Users,
  Settings,
  Menu,
  FolderOpen,
  UserPlus,
  HardDrive,
  MessageSquare,
  Play,
  ImageIcon,
  Globe2,
  Mic,
  Database,
  Server,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAppContext } from "src/context/app";
import { useSiteHead } from "src/hooks/useSiteHead";
import { siteResourceURL } from "src/api/upload";
import AdminSidebar, { type NavItem } from "./admin/AdminSidebar";
import AdminUserMenu from "./admin/AdminUserMenu";

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
        { to: "/admin/contents/galleries", icon: ImageIcon, label: t("admin:gallery") },
        { to: "/admin/contents/articles", icon: FileText, label: t("admin:article") },
        { to: "/admin/contents/podcasts", icon: Mic, label: t("admin:podcast") },
      ],
    },
    { to: "/admin/categories", icon: FolderOpen, label: t("admin:categoryManagement") },
    { to: "/admin/users", icon: Users, label: t("admin:userManagement") },
    { to: "/admin/nodes", icon: Server, label: t("admin:serviceNodes") },
    {
      to: "/admin/settings",
      icon: Settings,
      label: t("admin:systemConfig"),
      children: [
        { to: "/admin/settings/site", icon: Globe2, label: t("admin:siteConfig") },
        { to: "/admin/settings/auth", icon: UserPlus, label: t("admin:authConfig") },
        { to: "/admin/settings/storage", icon: HardDrive, label: t("admin:storageConfig") },
        { to: "/admin/settings/database-backup", icon: Database, label: t("admin:databaseBackup") },
        { to: "/admin/settings/wechat", icon: MessageSquare, label: t("admin:wechat") },
      ],
    },
  ];

  const handleToggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-surface flex min-h-screen">
      <AdminSidebar
        navItems={navItems}
        collapsed={sidebarCollapsed}
        siteTitle={siteTitle}
        siteLogoUrl={siteLogoUrl}
        expandedSections={expandedSections}
        onToggleSection={handleToggleSection}
      />

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
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Menu size={24} style={{ color: "var(--foreground)" }} />
          </button>

          <AdminUserMenu currentUser={currentUser} />
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
