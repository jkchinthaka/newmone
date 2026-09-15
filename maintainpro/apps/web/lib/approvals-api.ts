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
  processType: ApprovalProcessType;
  subjectEntityType: string;
  subjectEntityId: string;
  status: string;
  requestedAt: string;
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

export async function fetchApprovalInbox(params?: { page?: number; pageSize?: number }) {
  const response = await apiClient.get("/approvals/inbox", { params });
  const payload = response.data as { data: { items: ApprovalInboxItem[]; meta: unknown } };
  return payload.data;
}

export async function fetchApprovalRequest(id: string) {
  const response = await apiClient.get(`/approvals/${id}`);
  return (response.data as { data: Record<string, unknown> }).data;
}

export async function decideApproval(id: string, decision: "APPROVED" | "REJECTED", reason?: string) {
  const response = await apiClient.post(`/approvals/${id}/decide`, { decision, reason });
  return (response.data as { data: unknown }).data;
}
