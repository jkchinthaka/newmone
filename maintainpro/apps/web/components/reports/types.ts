export type ReportModuleSlug =
  | "operations"
  | "financials"
  | "user-activity"
  | "assets"
  | "inventory"
  | "performance"
  | "system-logs";

export type ReportTone = "neutral" | "success" | "warning" | "danger" | "info";
export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export type ReportFilters = {
  startDate: string;
  endDate: string;
  departmentId: string;
  userId: string;
  assetId: string;
  status: string;
  supplierId: string;
  category: string;
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: "asc" | "desc";
};

export type ReportSummaryCard = {
  label: string;
  value: string | number;
  subLabel?: string;
  tone?: ReportTone;
};

export type ReportChart = {
  id: string;
  title: string;
  type: "line" | "bar" | "pie";
  data: Array<Record<string, string | number>>;
  xKey?: string;
  yKeys?: string[];
  nameKey?: string;
  valueKey?: string;
};

export type ReportColumn = {
  key: string;
  label: string;
  type?: "text" | "number" | "currency" | "date" | "datetime" | "percent";
};

export type ReportTable = {
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ReportFilterOptions = {
  departments: Array<{ id: string; label: string }>;
  users: Array<{ id: string; label: string; role?: string }>;
  assets: Array<{ id: string; label: string; type: "asset" | "vehicle" }>;
  suppliers: Array<{ id: string; label: string }>;
  statuses: string[];
  categories: string[];
};

export type ReportModuleResponse = {
  module: ReportModuleSlug;
  title: string;
  description: string;
  generatedAt: string;
  refreshSeconds: number;
  filters: Partial<ReportFilters>;
  summaryCards: ReportSummaryCard[];
  charts: ReportChart[];
  table: ReportTable;
  insights: string[];
  filterOptions: ReportFilterOptions;
  coverageNotes: string[];
};

export type ReportsDashboardResponse = {
  generatedAt: string;
  refreshSeconds: number;
  filters: Partial<ReportFilters>;
  summaryCards: ReportSummaryCard[];
  moduleSummaries: Array<{
    module: ReportModuleSlug;
    label: string;
    value: string | number;
    helper: string;
    tone?: ReportTone;
  }>;
  crossModuleTrend: Array<Record<string, string | number>>;
  filterOptions: ReportFilterOptions;
  alerts: Array<{ type: string; message: string; tone?: ReportTone }>;
  dataCoverage: string[];
};

export type ReportModuleDefinition = {
  slug: ReportModuleSlug;
  label: string;
  description: string;
};