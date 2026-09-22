import { apiClient } from "./api-client";

export type MaintenanceRequestStatus =
  | "NEW"
  | "UNDER_REVIEW"
  | "NEEDS_INFORMATION"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED"
  | "CANCELLED"
  | "CONVERTED_TO_WO";

export type RequestPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ReportedUrgency = "NORMAL" | "URGENT" | "VERY_URGENT";
export type SafetyImpact = "NO" | "YES" | "NOT_SURE";
export type ProductionImpact = "NONE" | "REDUCED" | "STOPPED" | "NOT_SURE";

export type MaintenanceRequestListItem = {
  id: string;
  requestNumber: string;
  status: MaintenanceRequestStatus;
  statusLabel: string;
  priority: RequestPriority;
  description: string;
  affectsOperation: boolean;
  isEmergency: boolean;
  reportedUrgency?: string | null;
  safetyImpact?: string | null;
  productionImpact?: string | null;
  targetUnresolved?: boolean;
  approximateLocation?: string | null;
  jobDomain?: string | null;
  reportedAt: string;
  createdAt: string;
  publicUpdateNote?: string | null;
  workOrderId?: string | null;
  resolutionCode?: string | null;
  asset?: { id: string; assetTag: string; name: string } | null;
  vehicle?: {
    id: string;
    registrationNo: string;
    code?: string | null;
    name: string;
  } | null;
  site?: { id: string; code: string; name: string } | null;
  functionalLocation?: { id: string; code: string; name: string } | null;
  domain?: { id: string; code: string; name: string } | null;
  problemCategoryLabel?: string | null;
  reportedBy?: { id: string; name: string } | null;
};

export type ProblemCategory = {
  id: string;
  code: string;
  name: string;
};

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export async function listProblemCategories() {
  const res = await apiClient.get("/maintenance-requests/problem-categories");
  return unwrap<{ items: ProblemCategory[] }>(res.data);
}

export async function listMaintenanceRequests(params: Record<string, unknown> = {}) {
  const res = await apiClient.get("/maintenance-requests", { params });
  const body = res.data as { data: MaintenanceRequestListItem[]; meta?: Record<string, unknown> };
  return { items: body.data ?? [], meta: body.meta };
}

export async function getMaintenanceRequest(id: string) {
  const res = await apiClient.get(`/maintenance-requests/${id}`);
  return unwrap<Record<string, unknown>>(res.data);
}

export async function createMaintenanceRequest(body: Record<string, unknown>) {
  const res = await apiClient.post("/maintenance-requests", body);
  return unwrap<MaintenanceRequestListItem>(res.data);
}

export async function startRequestReview(id: string) {
  const res = await apiClient.post(`/maintenance-requests/${id}/start-review`);
  return unwrap(res.data);
}

export async function triageRequest(id: string, body: Record<string, unknown>) {
  const res = await apiClient.post(`/maintenance-requests/${id}/triage`, body);
  return unwrap(res.data);
}

export async function approveRequest(id: string) {
  const res = await apiClient.post(`/maintenance-requests/${id}/approve`);
  return unwrap(res.data);
}

export async function requestMoreInformation(
  id: string,
  body: { question: string; publicNote?: string }
) {
  const res = await apiClient.post(`/maintenance-requests/${id}/needs-information`, body);
  return unwrap(res.data);
}

export async function respondToInformationRequest(
  id: string,
  body: { response: string; evidenceIds?: string[] }
) {
  const res = await apiClient.post(`/maintenance-requests/${id}/respond`, body);
  return unwrap(res.data);
}

export async function resumeRequestReview(id: string, body?: { note?: string }) {
  const res = await apiClient.post(`/maintenance-requests/${id}/resume-review`, body ?? {});
  return unwrap(res.data);
}

export async function rejectRequest(
  id: string,
  body: { reasonType: string; reason?: string }
) {
  const res = await apiClient.post(`/maintenance-requests/${id}/reject`, body);
  return unwrap(res.data);
}

export async function cancelRequest(id: string, reason: string) {
  const res = await apiClient.post(`/maintenance-requests/${id}/cancel`, { reason });
  return unwrap(res.data);
}

export async function markRequestDuplicate(
  id: string,
  body: { canonicalRequestId: string; reason: string }
) {
  const res = await apiClient.post(`/maintenance-requests/${id}/mark-duplicate`, body);
  return unwrap(res.data);
}

export async function convertRequestToWorkOrder(id: string, title?: string) {
  const res = await apiClient.post(`/maintenance-requests/${id}/convert-to-work-order`, {
    title
  });
  return unwrap<{ alreadyConverted?: boolean; workOrder?: { id: string; woNumber: string } }>(
    res.data
  );
}

export async function fetchDuplicateCandidates(id: string) {
  const res = await apiClient.get(`/maintenance-requests/${id}/duplicate-candidates`);
  return unwrap<{ items: MaintenanceRequestListItem[] }>(res.data);
}
