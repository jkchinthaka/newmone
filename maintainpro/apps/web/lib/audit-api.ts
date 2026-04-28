import { apiClient } from "@/lib/api-client";

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AuditFieldChange {
  field: string;
  value: unknown;
}

export interface AuditActor {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}

export interface AuditEntry {
  id: string;
  tenantId: string | null;
  entity: string;
  entityId: string;
  action: AuditAction;
  createdAt: string;
  actor: AuditActor | null;
  /**
   * For UPDATE: array of { field, value } representing previous values.
   * For DELETE: full snapshot of the row before deletion.
   */
  beforeData: AuditFieldChange[] | Record<string, unknown> | null;
  /**
   * For UPDATE: array of { field, value } representing new values.
   * For CREATE: full snapshot of the created row.
   */
  afterData: AuditFieldChange[] | Record<string, unknown> | null;
}

export interface AuditPage {
  data: AuditEntry[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchEntityAudit(
  entity: string,
  entityId: string,
  page = 1,
  pageSize = 50
): Promise<AuditPage> {
  const res = await apiClient.get(`/audit-logs/${encodeURIComponent(entity)}/${encodeURIComponent(entityId)}`, {
    params: { page, pageSize }
  });
  return res.data as AuditPage;
}

export async function fetchAuditList(filters: {
  entity?: string;
  entityId?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
}): Promise<AuditPage> {
  const res = await apiClient.get("/audit-logs", { params: filters });
  return res.data as AuditPage;
}
