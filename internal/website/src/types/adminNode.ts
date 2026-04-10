export type AdminNodeStatus = "online" | "offline";

export interface AdminServiceNode {
  id: string;
  node_id: string;
  node_type: string;
  service_name: string;
  display_name: string;
  status: AdminNodeStatus;
  version: string;
  git_commit: string;
  build_time: string;
  started_at?: string;
  last_heartbeat_at: string;
  hostname: string;
  instance_ip: string;
  listen_addr: string;
  environment: string;
  region: string;
  zone: string;
  capabilities: string[];
  meta?: Record<string, string>;
  uptime_seconds: number;
}

export interface AdminNodeListSummary {
  online_count: number;
  offline_count: number;
  type_counts: Record<string, number>;
  version_drift: boolean;
}

export interface AdminNodeListResponse {
  online_items: AdminServiceNode[];
  offline_items: AdminServiceNode[];
  summary: AdminNodeListSummary;
}
