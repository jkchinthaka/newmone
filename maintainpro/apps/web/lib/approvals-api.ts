import { apiClient } from "./api-client";

export type ApprovalProcessType =
  | "CRITICAL_WORK_ORDER"
  | "HIGH_COST_WORK_ORDER"
  | "VENDOR_REPAIR"
  | "ASSET_RETIREMENT"
  | "WORK_ORDER_REOPEN"
  | "CLOSED_RECORD_CORRECTION"
  | "GATE_OVERRIDE"
  | "COMPLIANCE_EXCEPTION"
  | "BUDGET_EXCEPTION";

export type ApprovalRuleLevel = {
  level: number;
  approverRole?: string | null;
  approverUserId?: string | null;
  backupUserId?: string | null;
};

export type ApprovalRule = {
  id: string;
  name: string;
  processType: ApprovalProcessType;
  trigger: string;
  conditions: unknown;
  siteId?: string | null;
  departmentId?: string | null;
  domainId?: string | null;
  priorityScope: string[];
  workTypeScope: string[];
  amountThreshold?: number | null;
  amountField?: string | null;
  slaHours?: number | null;
  escalateToBackup: boolean;
  emergencyOverrideAllowed: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  version: number;
  isActive: boolean;
  levels: ApprovalRuleLevel[];
};

export type ApprovalInboxItem = {
  id: string;
  kind?: string;
  tab?: "requests" | "work_orders" | "parts" | "vendor_quotations" | "vendor_invoices" | "emergency";
  processType?: ApprovalProcessType | null;
  subjectEntityType?: string | null;
  subjectEntityId?: string | null;
  status: string;
  requestedAt: string;
  reference?: string;
  title?: string;
  requesterName?: string;
  assetLabel?: string | null;
  amount?: number | null;
  taxRatePercent?: number | null;
  priority?: string | null;
  age?: string;
  sla?: "green" | "amber" | "red";
  version?: number;
  canDecide?: boolean;
  canReturn?: boolean;
  workOrderId?: string | null;
  attachments?: Array<{ id: string; label: string }>;
  history?: Array<{ at: string; label: string; reason?: string | null }>;
  currentLevel?: number | null;
  dueAt?: string | null;
  overdue?: boolean;
  requester?: { firstName?: string; lastName?: string; email?: string };
  sourceContext?: Record<string, unknown> | null;
};

export async function listApprovalRules(params?: { processType?: string; activeOnly?: boolean }) {
  const response = await apiClient.get("/admin/approvals/rules", { params });
  return (response.data as { data: ApprovalRule[] }).data;
}

export async function createApprovalRule(body: Record<string, unknown>) {
  const response = await apiClient.post("/admin/approvals/rules", body);
  return (response.data as { data: ApprovalRule }).data;
}

export async function versionApprovalRule(id: string, body: Record<string, unknown>) {
  const response = await apiClient.post(`/admin/approvals/rules/${id}/version`, body);
  return (response.data as { data: ApprovalRule }).data;
}

export async function deactivateApprovalRule(id: string) {
  const response = await apiClient.patch(`/admin/approvals/rules/${id}/deactivate`);
  return (response.data as { data: ApprovalRule }).data;
}

export async function previewApprovalRule(body: Record<string, unknown>) {
  const response = await apiClient.post("/admin/approvals/rules/preview", body);
  return (response.data as { data: unknown }).data;
}

export async function simulateApprovalRule(body: Record<string, unknown>) {
  const response = await apiClient.post("/admin/approvals/rules/simulate", body);
  return (response.data as { data: unknown }).data;
}

export type ApprovalInboxQuery = {
  page?: number;
  pageSize?: number;
  tab?: string;
  search?: string;
  priority?: string;
  siteId?: string;
  from?: string;
  to?: string;
};

export type ApprovalInboxCounts = {
  all: number;
  requests: number;
  work_orders: number;
  parts: number;
  vendor_quotations: number;
  vendor_invoices: number;
  emergency: number;
};

/** `signal` lets a page drop the old request when filters change or the page closes. */
export async function fetchApprovalInbox(params?: ApprovalInboxQuery, options: { signal?: AbortSignal } = {}) {
  const response = await apiClient.get("/approvals/inbox", { params, signal: options.signal });
  const payload = response.data as {
    data: { items: ApprovalInboxItem[]; meta: { total: number; counts?: ApprovalInboxCounts } };
  };
  return payload.data;
}

export async function fetchApprovalRequest(id: string) {
  const response = await apiClient.get(`/approvals/${id}`);
  return (response.data as { data: Record<string, unknown> }).data;
}

export async function decideApproval(
  id: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  reason?: string,
  expectedVersion?: number,
  idempotencyKey?: string
) {
  const response = await apiClient.post(
    `/approvals/${id}/decide`,
    { decision, reason, expectedVersion },
    { headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined }
  );
  return (response.data as { data: unknown }).data;
}

export async function decideInboxItem(body: {
  id: string;
  kind: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  reason?: string;
  expectedVersion: number;
  workOrderId?: string | null;
  idempotencyKey?: string;
}) {
  const response = await apiClient.post("/approvals/inbox/decide", body, {
    headers: body.idempotencyKey ? { "Idempotency-Key": body.idempotencyKey } : undefined
  });
  return (response.data as { data: unknown }).data;
}

export async function bulkApproveInbox(items: Array<{ id: string; kind: string; expectedVersion: number; workOrderId?: string | null }>, idempotencyKey?: string) {
  const response = await apiClient.post(
    "/approvals/inbox/bulk-approve",
    { items },
    { headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined }
  );
  return (response.data as { data: { results: Array<{ id: string; ok: boolean; error?: string }> } }).data;
}
