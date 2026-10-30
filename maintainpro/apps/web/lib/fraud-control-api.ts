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

export type LongLabourRow = {
  id: string;
  workOrderId: string;
  woNumber: string | null;
  title: string | null;
  technicianName: string | null;
  startedAt: string;
  endedAt: string | null;
  stillRunning: boolean;
  hours: number;
  corrected: boolean;
};

export type FarPhotoRow = {
  id: string;
  evidenceType: string;
  takenAt: string;
  uploadedByName: string | null;
  workOrderId: string;
  woNumber: string | null;
  siteName: string;
  distanceMeters: number;
  allowedMeters: number;
};

export async function fetchLongLabourSessions(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: { limitHours: number; days: number; items: LongLabourRow[] } }>(
    "/reports/fraud-control/field-checks/long-labour",
    { signal }
  );
  return response.data.data;
}

export async function fetchPhotosFarFromSite(signal?: AbortSignal) {
  const response = await apiClient.get<{ data: { days: number; sitesWithLocation: number; items: FarPhotoRow[] } }>(
    "/reports/fraud-control/field-checks/photo-location",
    { signal }
  );
  return response.data.data;
}

/** "1.2 km" / "640 m" for the photo-distance column. */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
