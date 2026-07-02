import { apiClient } from "@/lib/api-client";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FraudDashboardAlert = {
  key: string;
  label: string;
  count: number;
  severity: RiskSeverity;
  module: string;
  actionOwner?: string;
  href?: string;
  lastUpdated: string;
};

export type FraudDashboardResponse = {
  alerts: FraudDashboardAlert[];
  summary: {
    totalAlerts: number;
    blockedAttempts: number;
    highSeverity: number;
  };
  disclaimer: string;
  generatedAt: string;
};

export type AdminOverrideRow = {
  id: string;
  createdAt: string;
  actorId?: string | null;
  actorRole?: string | null;
  module?: string | null;
  action: string;
  entity: string;
  entityId: string;
  reason?: string | null;
  event?: string | null;
  workOrderId?: string | null;
  riskSeverity: RiskSeverity;
};

export type PartsMisuseResponse = {
  metrics: Record<string, number | string | string[]>;
  cards: Array<{ type: string; label: string; count: number; severity: RiskSeverity }>;
  riskNotes: string[];
  disclaimer: string;
  generatedAt: string;
};

export async function fetchFraudDashboard() {
  const response = await apiClient.get<{ data: FraudDashboardResponse }>("/reports/fraud-control/dashboard");
  return response.data.data;
}

export async function fetchAdminOverrides(query: {
  dateFrom?: string;
  dateTo?: string;
  module?: string;
  limit?: number;
} = {}) {
  const response = await apiClient.get<{ data: { rows: AdminOverrideRow[]; total: number; generatedAt: string } }>(
    "/reports/fraud-control/admin-overrides",
    { params: query }
  );
  return response.data.data;
}

export async function fetchPartsMisuseReport() {
  const response = await apiClient.get<{ data: PartsMisuseResponse }>("/reports/fraud-control/parts-misuse");
  return response.data.data;
}

export function severityClass(severity: RiskSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
