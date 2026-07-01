import type { RiskSeverity } from "../../common/utils/maintenance-risk-score";
import type { ReportQuery } from "./reports.service";

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

export interface MaintenanceReportQuery extends ReportQuery {
  exceptionType?: string;
  severity?: RiskSeverity;
  branch?: string;
  employeeId?: string;
}

export interface MaintenanceExceptionCard {
  type: MaintenanceExceptionType;
  label: string;
  count: number;
  severity: RiskSeverity;
  lastUpdated: string;
}

export interface MaintenanceExceptionRow {
  workOrderId: string;
  woNumber: string;
  title: string;
  assetName?: string | null;
  vehicleLabel?: string | null;
  departmentName?: string | null;
  branchName?: string | null;
  status: string;
  priority: string;
  assignedEmployee?: string | null;
  exceptionType: string;
  exceptionReason: string;
  costImpact?: number | null;
  createdAt: string;
  dueDate?: string | null;
  actionOwner?: string | null;
  riskScore: number;
  riskSeverity: RiskSeverity;
}

export const MAINTENANCE_EXCEPTION_LABELS: Record<MaintenanceExceptionType, string> = {
  "open-high-risk": "Open high-risk work orders",
  "completed-without-evidence": "Completed without required evidence",
  "pending-supervisor-verification": "Awaiting supervisor verification",
  "closed-without-supervisor-verification": "Closed without supervisor verification",
  "parts-issued-not-completed": "Parts issued but job not completed",
  "parts-not-accounted": "Parts not fully accounted for",
  "pending-part-returns": "Pending part return confirmations",
  "duplicate-part-requests": "Duplicate part requests",
  "high-cost-part-issues": "High-cost part issues",
  "repeated-breakdowns": "Repeated breakdowns by asset",
  "reopened-work-orders": "Reopened work orders (30d)",
  "cancelled-work-orders": "Cancelled work orders (30d)",
  "assigned-during-leave": "Assigned while on approved leave",
  "above-daily-capacity": "Employees above daily capacity",
  "overdue-work-orders": "Overdue work orders"
};
