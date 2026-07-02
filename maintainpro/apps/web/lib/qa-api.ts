import { apiClient } from "./api-client";

export type QaIssueCategory =
  | "REQUIREMENT_ERROR"
  | "UI_UX_ERROR"
  | "FRONTEND_ERROR"
  | "BACKEND_ERROR"
  | "DATABASE_ERROR"
  | "AUTH_RBAC_ERROR"
  | "API_INTEGRATION_ERROR"
  | "DEPLOYMENT_ERROR"
  | "PERFORMANCE_ERROR"
  | "SECURITY_ERROR"
  | "DATA_QUALITY_ERROR"
  | "TESTING_QA_ERROR";

export type QaIssueRow = {
  id: string;
  issueNo: string;
  title: string;
  description: string;
  category: QaIssueCategory;
  severity: string;
  priority: string;
  status: string;
  affectedModule?: string | null;
  affectedPage?: string | null;
  environment: string;
  linkedUatPhase?: string | null;
  isSensitive?: boolean;
  technicalDetailsRestricted?: boolean;
  createdAt: string;
};

export type QaCategoryMeta = {
  key: QaIssueCategory;
  label: string;
  description: string;
  examples: string[];
  severityGuidance: string;
  recommendedOwner: string;
  recommendedFixApproach: string;
};

export async function fetchQaCategories() {
  const response = await apiClient.get<{ data: QaCategoryMeta[] }>("/qa/categories");
  return response.data.data ?? [];
}

export async function fetchQaDashboard() {
  const response = await apiClient.get<{ data: Record<string, unknown> }>("/qa/dashboard");
  return response.data.data;
}

export async function fetchQaIssues(params: Record<string, string | number | undefined> = {}) {
  const response = await apiClient.get<{ data: QaIssueRow[]; meta?: { page: number; total: number; totalPages: number } }>(
    "/qa/issues",
    { params }
  );
  return { items: response.data.data ?? [], meta: response.data.meta };
}

export async function fetchQaIssue(id: string) {
  const response = await apiClient.get<{ data: QaIssueRow & Record<string, unknown> }>(`/qa/issues/${id}`);
  return response.data.data;
}

export async function createQaIssue(payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: QaIssueRow }>("/qa/issues", payload);
  return response.data.data;
}

export async function triageQaIssue(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: QaIssueRow }>(`/qa/issues/${id}/triage`, payload);
  return response.data.data;
}

export async function closeQaIssue(id: string, payload: { resolutionNote: string; fixSummary?: string }) {
  const response = await apiClient.post<{ data: QaIssueRow }>(`/qa/issues/${id}/close`, payload);
  return response.data.data;
}

export async function addQaRca(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: QaIssueRow }>(`/qa/issues/${id}/rca`, payload);
  return response.data.data;
}

export async function addQaRegression(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: QaIssueRow }>(`/qa/issues/${id}/regression-test`, payload);
  return response.data.data;
}

export async function acceptQaRisk(id: string, payload: Record<string, unknown>) {
  const response = await apiClient.post<{ data: QaIssueRow }>(`/qa/issues/${id}/accept-risk`, payload);
  return response.data.data;
}

export async function fetchReleaseQualityReport(params: Record<string, string | undefined> = {}) {
  const response = await apiClient.get<{ data: { summary: Record<string, number>; verdict: string } }>(
    "/qa/reports/release-quality",
    { params }
  );
  return response.data.data;
}

export async function createQaIssueFromHealthCheck(payload: {
  checkKey: string;
  checkLabel: string;
  message: string;
  category?: string;
  severity?: string;
}) {
  const response = await apiClient.post<{ data: QaIssueRow }>("/qa/issues/from-health-check", payload);
  return response.data.data;
}
