import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Server } from "lucide-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { listAdminNodes } from "src/api/adminNodes";
import type { AdminServiceNode } from "src/types/adminNode";

const tableBorder = "1px solid var(--surface-border)";
const thStyle: React.CSSProperties = {
  background: "var(--surface-muted)",
  padding: "12px 16px",
  textAlign: "left",
  color: "var(--text-secondary)",
  fontWeight: 500,
  whiteSpace: "nowrap",
  borderBottom: tableBorder,
};
const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
  borderTop: tableBorder,
  verticalAlign: "top",
};

function formatUptime(seconds: number) {
  if (!seconds || seconds < 0) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatRelativeTime(value: string) {
  const now = dayjs();
  const target = dayjs(value);
  const diffSeconds = Math.max(now.diff(target, "second"), 0);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = now.diff(target, "minute");
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = now.diff(target, "hour");
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${now.diff(target, "day")}d ago`;
}

function statusColors(status: string) {
  if (status === "online") return { background: "#dcfce7", color: "#166534" };
  return { background: "#fee2e2", color: "#991b1b" };
}

function NodeTable({
  items,
  emptyText,
  t,
}: {
  items: AdminServiceNode[];
  emptyText: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (items.length === 0) {
    return (
        <div className="app-text-tertiary py-10 text-sm text-center">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th style={thStyle}>{t("admin:node")}</th>
            <th style={thStyle}>{t("admin:type")}</th>
            <th style={thStyle}>{t("admin:status")}</th>
            <th style={thStyle}>{t("admin:version")}</th>
            <th style={thStyle}>{t("admin:uptime")}</th>
            <th style={thStyle}>{t("admin:lastHeartbeat")}</th>
            <th style={thStyle}>{t("admin:host")}</th>
            <th style={thStyle}>{t("admin:environment")}</th>
            <th style={thStyle}>{t("admin:capabilities")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const badgeStyle = statusColors(item.status);
            return (
              <tr key={item.id}>
                <td style={tdStyle}>
                  <div className="font-medium text-foreground">
                    {item.display_name || item.node_id}
                  </div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {item.node_id}
                  </div>
                </td>
                <td style={tdStyle}>{item.node_type || "-"}</td>
                <td style={tdStyle}>
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                    style={badgeStyle}
                  >
                    {t(`admin:${item.status}`)}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div className="text-foreground">{item.version || "-"}</div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {item.git_commit || "-"}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div className="text-foreground">
                    {formatUptime(item.uptime_seconds)}
                  </div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {item.started_at
                      ? dayjs(item.started_at).format("YYYY-MM-DD HH:mm:ss")
                      : "-"}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div className="text-foreground">
                    {dayjs(item.last_heartbeat_at).format(
                      "YYYY-MM-DD HH:mm:ss",
                    )}
                  </div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {formatRelativeTime(item.last_heartbeat_at)}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div className="text-foreground">{item.hostname || "-"}</div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {item.instance_ip || "-"}
                  </div>
                </td>
                <td style={tdStyle}>
                  <div className="text-foreground">
                    {item.environment || "-"}
                  </div>
                  <div className="app-text-tertiary text-xs mt-1">
                    {[item.region, item.zone].filter(Boolean).join(" / ") ||
                      "-"}
                  </div>
                </td>
                <td style={tdStyle}>
                  {item.capabilities?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {item.capabilities.map((capability) => (
                        <span
                          key={capability}
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ background: "var(--surface-muted)", color: "var(--text-secondary)" }}
                        >
                          {capability}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminNodes() {
  const { t } = useTranslation("admin");
  const [nodeType, setNodeType] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-nodes", nodeType],
    queryFn: async () => {
      const res = await listAdminNodes(nodeType || undefined);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={32}
          className="app-text-tertiary animate-spin"
        />
      </div>
    );
  }

  const summary = data?.summary;
  const onlineItems = data?.online_items || [];
  const offlineItems = data?.offline_items || [];

  return (
    <div className="app-surface space-y-6">
      <div
        className="app-surface-elevated rounded-xl p-6"
        style={{ border: "1px solid var(--surface-border)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Server size={20} className="text-foreground" />
              <h1 className="text-xl font-semibold text-foreground">
                {t("admin:serviceNodes")}
              </h1>
            </div>
            <p className="app-text-secondary text-sm">
              {t("admin:serviceNodesDesc")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={nodeType}
              onChange={(e) => setNodeType(e.target.value)}
              className="h-9 rounded-md border px-3 text-sm"
              style={{
                borderColor: "var(--surface-border)",
                color: "var(--foreground)",
                background: "var(--surface-elevated)",
              }}
            >
              <option value="">{t("admin:allNodeTypes")}</option>
              <option value="web">{t("admin:webNode")}</option>
              <option value="worker">{t("admin:workerNode")}</option>
              <option value="scheduler">{t("admin:schedulerNode")}</option>
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {t("admin:refresh")}
            </Button>
          </div>
        </div>

        {summary?.version_drift && (
          <div className="theme-warn-banner mt-4 rounded-lg px-4 py-3 text-sm">
            {t("admin:versionDriftWarning")}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div
            className="rounded-xl p-4"
            style={{ border: "1px solid var(--surface-border)" }}
          >
            <div className="app-text-secondary text-sm mb-1">
              {t("admin:onlineNodes")}
            </div>
            <div className="text-lg font-medium text-foreground">
              {summary?.online_count ?? 0}
            </div>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ border: "1px solid var(--surface-border)" }}
          >
            <div className="app-text-secondary text-sm mb-1">
              {t("admin:offlineNodes")}
            </div>
            <div className="text-lg font-medium text-foreground">
              {summary?.offline_count ?? 0}
            </div>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ border: "1px solid var(--surface-border)" }}
          >
            <div className="app-text-secondary text-sm mb-1">
              {t("admin:webNode")}
            </div>
            <div className="text-lg font-medium text-foreground">
              {summary?.type_counts?.web ?? 0}
            </div>
          </div>
          <div
            className="rounded-xl p-4"
            style={{ border: "1px solid var(--surface-border)" }}
          >
            <div className="app-text-secondary text-sm mb-1">
              {t("admin:workerAndScheduler")}
            </div>
            <div className="text-lg font-medium text-foreground">
              {(summary?.type_counts?.worker ?? 0) +
                (summary?.type_counts?.scheduler ?? 0)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="app-surface-elevated rounded-xl p-6"
        style={{ border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-medium text-foreground">
            {t("admin:onlineNodes")}
          </h2>
          <span className="app-text-secondary text-sm">
            {t("admin:nodeCount", { count: onlineItems.length })}
          </span>
        </div>
        <NodeTable
          items={onlineItems}
          emptyText={t("admin:noOnlineNodes")}
          t={t}
        />
      </div>

      <div
        className="app-surface-elevated rounded-xl p-6"
        style={{ border: "1px solid var(--surface-border)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-medium text-foreground">
            {t("admin:offlineNodes")}
          </h2>
          <span className="app-text-secondary text-sm">
            {t("admin:nodeCount", { count: offlineItems.length })}
          </span>
        </div>
        <NodeTable
          items={offlineItems}
          emptyText={t("admin:noOfflineNodes")}
          t={t}
        />
      </div>
    </div>
  );
}

export default AdminNodes;
