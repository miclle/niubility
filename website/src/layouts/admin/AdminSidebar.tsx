import { NavLink, useLocation } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronDown, ArrowLeft, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

// NavChild represents a sub-menu item under a parent nav item.
export interface NavChild {
  to: string;
  icon: LucideIcon;
  label: string;
}

// NavItem represents a top-level navigation item, optionally with children.
export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  children?: NavChild[];
}

interface AdminSidebarProps {
  navItems: NavItem[];
  collapsed: boolean;
  siteTitle: string;
  siteLogoUrl: string | null;
  expandedSections: Record<string, boolean>;
  onToggleSection: (key: string) => void;
}

// AdminSidebar renders the fixed sidebar navigation for the admin panel.
export default function AdminSidebar({
  navItems,
  collapsed,
  siteTitle,
  siteLogoUrl,
  expandedSections,
  onToggleSection,
}: AdminSidebarProps) {
  const { t } = useTranslation("admin");
  const location = useLocation();

  return (
    <aside
      className="app-surface admin-sidebar fixed top-0 left-0 h-screen flex flex-col transition-all duration-200 z-30"
      style={{
        width: collapsed ? 72 : 240,
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
          ) : collapsed ? (
            siteTitle.charAt(0)
          ) : (
            siteTitle
          )}
        </NavLink>
        {!collapsed && (
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

            return (
              <div key={item.to}>
                {collapsed ? (
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
                    <button
                      onClick={() => onToggleSection(item.to)}
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
                justifyContent: collapsed ? "center" : "flex-start",
              }}
            >
              {collapsed ? (
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
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          {collapsed ? (
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
  );
}
