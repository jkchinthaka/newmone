import { apiClient } from "@/lib/api-client";

export interface AdminOverview {
  users: { active: number; inactive: number; total: number };
  dataQuality: {
    issuesBySeverity: { CRITICAL: number; HIGH: number; WARNING: number; INFO: number };
    totalIssues: number;
  };
  pendingImports: number;
  rules: number;
}

export interface DataQualityIssue {
  code: string;
  severity: "CRITICAL" | "HIGH" | "WARNING" | "INFO";
  domain: string;
  entityType: string;
  entityId?: string;
  message: string;
  suggestedAction?: string;
  count?: number;
}

export interface DeactivatePreview {
  allowed: boolean;
  code: string;
  requireReassignment: boolean;
  openWorkOrderIds: string[];
  message: string;
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await apiClient.get<{ data: AdminOverview }>("/admin-governance/overview");
  return res.data.data;
}

export async function fetchDataQualityIssues(): Promise<DataQualityIssue[]> {
  const res = await apiClient.get<{ data: DataQualityIssue[] }>("/admin-governance/data-quality");
  return res.data.data;
}

export async function fetchDeactivatePreview(userId: string): Promise<DeactivatePreview> {
  const res = await apiClient.get<{ data: DeactivatePreview }>(`/admin-governance/users/${userId}/deactivate-preview`);
  return res.data.data;
}

export async function guardConfigChange(payload: {
  confirmed: boolean;
  impactPreviewProvided: boolean;
  reason: string;
  effectiveFrom?: string;
}): Promise<{ allowed: boolean; code: string }> {
  const res = await apiClient.post<{ data: { allowed: boolean; code: string } }>("/admin-governance/config-change/guard", payload);
  return res.data.data;
}
