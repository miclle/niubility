import client from "./client";
import type { AdminNodeListResponse } from "src/types/adminNode";

export function listAdminNodes(nodeType?: string) {
  return client.get<AdminNodeListResponse>("/admin/nodes", {
    params: nodeType ? { node_type: nodeType } : undefined,
  });
}
