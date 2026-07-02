import { apiClient } from "@/lib/api-client";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ManagementReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  branch?: string;
  departmentId?: string;
  assetId?: string;
  vehicleId?: string;
  technicianId?: string;
  vendorId?: string;
  page?: number;
  pageSize?: number;
};

export type ManagementSummaryCard = {
  key: string;
  label: string;
  value: number | string;
  subLabel?: string;
  severity?: RiskSeverity;
};

export type ProfitabilitySummary = {
  cards: ManagementSummaryCard[];
  monthlyTrend: Array<{
    month: string;
    totalCost: number;
    partsCost: number;
    vendorCost: number;
    workOrderCount: number;
    correctiveCount: number;
  }>;
  topAssets: CostEntityRow[];
  topVehicles: CostEntityRow[];
  generatedAt: string;
  disclaimer: string;
};

export type CostEntityRow = {
  rank: number;
  id: string;
  label: string;
  departmentName?: string;
  branchName?: string;
  totalMaintenanceCost: number;
  partsCost: number;
  vendorCost: number;
  laborCost: number;
  workOrderCount: number;
  repeatedBreakdownCount: number;
  downtimeHours: number;
  lastRepairDate?: string | null;
  riskSeverity: RiskSeverity;
  recommendedAction: string;
  repairVsReplaceReview: boolean;
  costPerKm?: number | null;
};

export type PaginatedReport<T> = {
  rows: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  generatedAt: string;
  disclaimer: string;
  filtersApplied?: Record<string, unknown>;
};

function buildParams(filters: ManagementReportFilters) {
  return {
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    branch: filters.branch,
    departmentId: filters.departmentId,
    assetId: filters.assetId,
    vehicleId: filters.vehicleId,
    technicianId: filters.technicianId,
    vendorId: filters.vendorId,
    page: filters.page,
    pageSize: filters.pageSize
  };
}

export async function fetchProfitabilitySummary(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: ProfitabilitySummary }>("/reports/management/profitability/summary", {
    params: buildParams(filters)
  });
  return response.data.data;
}

export async function fetchTopHighCostAssets(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: { rows: CostEntityRow[] } }>("/reports/management/top-high-cost-assets", {
    params: buildParams(filters)
  });
  return response.data.data.rows;
}

export async function fetchTopHighCostVehicles(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: { rows: CostEntityRow[] } }>("/reports/management/top-high-cost-vehicles", {
    params: buildParams(filters)
  });
  return response.data.data.rows;
}

export async function fetchCostByDepartment(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: PaginatedReport<Record<string, unknown>> }>(
    "/reports/management/cost-by-department",
    { params: buildParams(filters) }
  );
  return response.data.data;
}

export async function fetchCostByCategory(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: PaginatedReport<Record<string, unknown>> }>(
    "/reports/management/cost-by-category",
    { params: buildParams(filters) }
  );
  return response.data.data;
}

export async function fetchRepeatedBreakdowns(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: PaginatedReport<Record<string, unknown>> }>(
    "/reports/management/repeated-breakdowns",
    { params: buildParams(filters) }
  );
  return response.data.data;
}

export async function fetchVendorCostComparison(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: PaginatedReport<Record<string, unknown>> }>(
    "/reports/management/vendor-cost-comparison",
    { params: buildParams(filters) }
  );
  return response.data.data;
}

export async function fetchRepairVsReplace(filters: ManagementReportFilters = {}) {
  const response = await apiClient.get<{ data: PaginatedReport<Record<string, unknown>> }>(
    "/reports/management/repair-vs-replace",
    { params: buildParams(filters) }
  );
  return response.data.data;
}

export async function downloadManagementReportExport(reportKey: string, filters: ManagementReportFilters = {}) {
  const response = await apiClient.get(`/reports/management/${reportKey}/export`, {
    params: buildParams(filters),
    responseType: "blob"
  });
  return response.data as Blob;
}

export function defaultManagementFilters(): ManagementReportFilters {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    dateFrom: start.toISOString().slice(0, 10),
    dateTo: end.toISOString().slice(0, 10)
  };
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

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(value);
}
