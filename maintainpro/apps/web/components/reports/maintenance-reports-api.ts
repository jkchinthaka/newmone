import { apiClient } from "@/lib/api-client";

export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type MaintenanceExceptionType =
  | "open-high-risk"
  | "completed-without-evidence"
  | "pending-supervisor-verification"
  | "closed-without-supervisor-verification"
  | "parts-issued-not-completed"
  | "parts-not-accounted"
  | "pending-part-returns"
  | "duplicate-part-requests"
  | "high-cost-part-issues"
  | "repeated-breakdowns"
  | "reopened-work-orders"
  | "cancelled-work-orders"
  | "assigned-during-leave"
  | "above-daily-capacity"
  | "overdue-work-orders";

export interface MaintenanceExceptionCard {
  type: MaintenanceExceptionType;
  label: string;
  count: number;
  severity: ExceptionSeverity;
  lastUpdated: string;
}

export interface MaintenanceExceptionRow {
  workOrderId: string;
  woNumber: string;
  title: string;
  assetName?: string | null;
  status: string;
  priority: string;
  assignedEmployee?: string | null;
  exceptionType: string;
  exceptionReason: string;
  costImpact?: number | null;
  createdAt: string;
  dueDate?: string | null;
  riskScore: number;
  riskSeverity: ExceptionSeverity;
}

export interface MaintenanceReportFilters {
  startDate: string;
  endDate: string;
  departmentId?: string;
  assetId?: string;
  status?: string;
  severity?: ExceptionSeverity;
  search?: string;
  page?: number;
  pageSize?: number;
}

function unwrap<T>(payload: unknown, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload ?? fallback) as T;
}

export function defaultMaintenanceFilters(): MaintenanceReportFilters {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    page: 1,
    pageSize: 25
  };
}

function toParams(filters: MaintenanceReportFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined && value !== null)
  );
}

export async function fetchMaintenanceExceptions(filters: MaintenanceReportFilters) {
  const res = await apiClient.get("/reports/maintenance/exceptions", { params: toParams(filters) });
  return unwrap(res.data, { cards: [] as MaintenanceExceptionCard[], generatedAt: new Date().toISOString(), title: "" });
}

export async function fetchMaintenanceExceptionDetail(type: string, filters: MaintenanceReportFilters) {
  const res = await apiClient.get(`/reports/maintenance/exceptions/${type}`, { params: toParams(filters) });
  return unwrap(res.data, { rows: [] as MaintenanceExceptionRow[], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
}

export async function fetchMaintenanceKpis(filters: MaintenanceReportFilters) {
  const res = await apiClient.get("/reports/maintenance/kpis", { params: toParams(filters) });
  return unwrap(res.data, {});
}

export async function exportMaintenanceException(type: string, filters: MaintenanceReportFilters) {
  const response = await apiClient.get(`/reports/maintenance/exceptions/${type}/export`, {
    params: toParams(filters),
    responseType: "blob"
  });
  const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `maintenance-${type}-${filters.endDate}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchWorkOrderRiskScore(workOrderId: string) {
  const res = await apiClient.get(`/reports/maintenance/risk-score/${workOrderId}`);
  return unwrap(res.data, { score: 0, severity: "LOW" as ExceptionSeverity, disclaimer: "" });
}

export function severityClass(severity: ExceptionSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "border-rose-300 bg-rose-50 text-rose-900";
    case "HIGH":
      return "border-orange-300 bg-orange-50 text-orange-900";
    case "MEDIUM":
      return "border-amber-300 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}
