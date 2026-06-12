import { apiClient } from "@/lib/api-client";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent
} from "@/lib/localization";

import {
  ReportExportFormat,
  ReportFilters,
  ReportModuleDefinition,
  ReportModuleResponse,
  ReportModuleSlug,
  ReportsDashboardResponse
} from "./types";

type Envelope<T> = { data?: T; message?: string };

export const REPORT_MODULES: ReportModuleDefinition[] = [
  { slug: "operations", label: "Operations", description: "Jobs, departments, technicians, delays, and status trends" },
  { slug: "financials", label: "Financials", description: "Expenses, job cost, supplier spend, parts cost, and budget signals" },
  { slug: "user-activity", label: "User Activity", description: "Logins, record changes, active users, and role-based activity" },
  { slug: "assets", label: "Assets & Equipment", description: "Maintenance history, downtime, breakdowns, cost, and upcoming service" },
  { slug: "inventory", label: "Inventory & Parts", description: "Stock levels, alerts, movements, supplier performance, and velocity" },
  { slug: "performance", label: "Performance KPIs", description: "Completion rate, response time, overdue rate, efficiency, and productivity" },
  { slug: "system-logs", label: "System Logs", description: "Audit history, security changes, and system coverage notes" },
  { slug: "driver-intelligence", label: "Driver Intelligence", description: "Driver scoring, risk levels, eligibility, and linked operational signals" },
  { slug: "fuel-analytics", label: "Fuel Analytics", description: "Fuel cost, consumption, anomaly flags, and vehicle fuel efficiency trends" },
  { slug: "vehicle-cost-analytics", label: "Vehicle Cost Analytics", description: "Net vehicle cost across fuel, maintenance, accidents, fines, and insurance" }
];

export function isReportModuleSlug(value: string): value is ReportModuleSlug {
  return REPORT_MODULES.some((module) => module.slug === value);
}

export function defaultReportFilters(): ReportFilters {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 29);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
    departmentId: "",
    departmentIds: [],
    userId: "",
    driverId: "",
    assetId: "",
    vehicleId: "",
    status: "",
    supplierId: "",
    category: "",
    search: "",
    page: 1,
    pageSize: 15,
    sortBy: "",
    sortDirection: "desc"
  };
}

export function toQueryParams(filters: ReportFilters) {
  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(",") : value] as const)
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

export async function getReportsDashboard(filters: ReportFilters): Promise<ReportsDashboardResponse> {
  const response = await apiClient.get<Envelope<ReportsDashboardResponse>>("/reports/dashboard", {
    params: toQueryParams(filters)
  });
  return response.data.data as ReportsDashboardResponse;
}

export async function getReportModule(module: ReportModuleSlug, filters: ReportFilters): Promise<ReportModuleResponse> {
  const response = await apiClient.get<Envelope<ReportModuleResponse>>(`/reports/${module}`, {
    params: toQueryParams(filters)
  });
  return response.data.data as ReportModuleResponse;
}

export async function downloadReportExport(module: ReportModuleSlug, format: ReportExportFormat, filters: ReportFilters) {
  const response = await apiClient.get(`/reports/${module}/export`, {
    params: {
      ...toQueryParams(filters),
      format
    },
    responseType: "blob"
  });

  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `${module}-report.${format === "xlsx" ? "xlsx" : format}`;
  const contentTypeHeader = response.headers["content-type"];
  const contentType = typeof contentTypeHeader === "string" ? contentTypeHeader : "application/octet-stream";
  const blob = new Blob([response.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatReportValue(value: string | number | null | undefined, type?: string): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (type === "currency") {
    return formatCurrency(Number(value) || 0, { fallback: "-" });
  }

  if (type === "percent") {
    return formatPercent(Number(value), { fallback: "-" });
  }

  if (type === "date") {
    return formatDate(value, { fallback: "-" });
  }

  if (type === "datetime") {
    return formatDateTime(value, { fallback: "-" });
  }

  return String(value);
}

export function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}