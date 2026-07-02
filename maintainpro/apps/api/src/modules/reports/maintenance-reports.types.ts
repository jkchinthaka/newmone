import type { RiskSeverity } from "../../common/utils/maintenance-risk-score";
import type { ReportQuery } from "./reports.service";

export type MaintenanceExceptionType =
  | "open-high-risk"
  | "completed-without-evidence"
  | "required-evidence-missing"
  | "technician-completed-without-evidence"
  | "supervisor-blocked-missing-evidence"
  | "qr-mismatch"
  | "qr-override"
  | "evidence-rejected"
  | "offline-sync-failed"
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
  | "overdue-work-orders"
  | "vendor-repair-without-quotation"
  | "vendor-repair-without-invoice"
  | "invoice-exceeds-quotation"
  | "duplicate-vendor-invoice"
  | "high-cost-vendor-repair"
  | "repeated-vendor-repair"
  | "blacklisted-vendor-used"
  | "finance-approval-pending"
  | "vendor-completed-not-verified"
  | "emergency-vendor-override"
  | "same-user-vendor-approval"
  | "parts-issue-without-work-order"
  | "maker-checker-violation";

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
  "required-evidence-missing": "Required evidence missing",
  "technician-completed-without-evidence": "Technician completed without evidence",
  "supervisor-blocked-missing-evidence": "Supervisor verification blocked by missing evidence",
  "qr-mismatch": "QR asset/vehicle mismatch",
  "qr-override": "QR verification overridden",
  "evidence-rejected": "Evidence rejected — rework required",
  "offline-sync-failed": "Offline evidence sync failed",
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
  "overdue-work-orders": "Overdue work orders",
  "vendor-repair-without-quotation": "Vendor repair without quotation",
  "vendor-repair-without-invoice": "Vendor repair without invoice",
  "invoice-exceeds-quotation": "Invoice exceeds approved quotation",
  "duplicate-vendor-invoice": "Duplicate vendor invoice",
  "high-cost-vendor-repair": "High-cost vendor repair",
  "repeated-vendor-repair": "Repeated vendor repair for same asset",
  "blacklisted-vendor-used": "Blacklisted vendor used",
  "finance-approval-pending": "Finance approval pending",
  "vendor-completed-not-verified": "Vendor completed but not supervisor verified",
  "emergency-vendor-override": "Emergency vendor repair override used",
  "same-user-vendor-approval": "Same user requested and approved vendor repair",
  "parts-issue-without-work-order": "Parts issue without work order attempt",
  "maker-checker-violation": "Maker-checker approval violation attempts"
};
