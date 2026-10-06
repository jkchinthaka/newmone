import type { RiskSeverity } from "../../common/utils/maintenance-risk-score";
import type { RecommendedAction } from "../../common/utils/management-intelligence-cost.util";

export interface ManagementReportQuery {
  dateFrom?: string;
  dateTo?: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  branch?: string;
  departmentId?: string;
  assetId?: string;
  vehicleId?: string;
  categoryId?: string;
  typeId?: string;
  issueId?: string;
  technicianId?: string;
  vendorId?: string;
  supplierId?: string;
  riskSeverity?: RiskSeverity;
  minCost?: number;
  maxCost?: number;
  page?: number;
  pageSize?: number;
  repeatWindowDays?: number;
}

export type ManagementReportKey =
  | "profitability-summary"
  | "cost-by-asset"
  | "cost-by-vehicle"
  | "cost-by-department"
  | "cost-by-branch"
  | "cost-by-category"
  | "top-high-cost-assets"
  | "top-high-cost-vehicles"
  | "repeated-breakdowns"
  | "vendor-cost-comparison"
  | "parts-usage-by-technician"
  | "monthly-cost-trend"
  | "repair-vs-replace"
  | "downtime-cost";

export type ManagementMetricUnit = "currency" | "hours" | "count" | "text";

export interface ManagementSummaryCard {
  key: string;
  label: string;
  value: number | string;
  /** How the value must be shown. Only real money is "currency" (QA MI unit defect). */
  unit: ManagementMetricUnit;
  subLabel?: string;
  /** Numeric amount behind subLabel, with its unit, so the UI can format it. */
  subValue?: number;
  subUnit?: ManagementMetricUnit;
  severity?: RiskSeverity;
  href?: string;
}

export interface CostRowBase {
  totalMaintenanceCost: number;
  partsCost: number;
  vendorCost: number;
  laborCost: number;
  workOrderCount: number;
  repeatedBreakdownCount: number;
  downtimeHours: number;
  highRiskCount: number;
  lastRepairDate?: string | null;
  riskSeverity: RiskSeverity;
  recommendedAction: RecommendedAction;
  repairVsReplaceReview: boolean;
}

export interface PaginatedRows<T> {
  rows: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  totals?: Record<string, number>;
  generatedAt: string;
  disclaimer: string;
  filtersApplied: Record<string, unknown>;
  truncated?: boolean;
}
