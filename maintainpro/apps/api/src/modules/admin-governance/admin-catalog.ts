export type AdminNavSection = {
  id: string;
  title: string;
  description: string;
  href?: string;
  statusLabel?: string;
  group?: string;
  technicalOnly?: boolean;
};

export type DataQualityFindingCode =
  | "DUPLICATE_ASSETS"
  | "MISSING_LOCATION"
  | "MISSING_CRITICALITY"
  | "STALE_METER"
  | "MISSING_PM_CHECKLIST"
  | "RETIRED_ASSET_WITH_PM"
  | "INACTIVE_TECH_WITH_JOBS"
  | "MISSING_RCA"
  | "ERP_MAPPING_ERROR"
  | "STALE_MILEAGE"
  | "EXPIRED_COMPLIANCE"
  | "FLEET_NO_ASSET_LINK"
  | "ERP_UNMAPPED_PARTS"
  | "APPROVAL_RULE_NO_APPROVERS";

export type DataQualitySeverity = "CRITICAL" | "HIGH" | "WARNING" | "INFO";

export const DATA_QUALITY_RULES: Array<{
  code: DataQualityFindingCode;
  severity: DataQualitySeverity;
  domain: string;
  entityType: string;
  message: string;
  suggestedAction?: string;
}> = [
  {
    code: "DUPLICATE_ASSETS",
    severity: "CRITICAL",
    domain: "assets",
    entityType: "Asset",
    message: "Duplicate asset records detected (same serial or tag)",
    suggestedAction: "Merge or archive duplicate records in the asset registry"
  },
  {
    code: "STALE_METER",
    severity: "HIGH",
    domain: "assets",
    entityType: "Asset",
    message: "Asset meter reading not updated within expected interval",
    suggestedAction: "Update meter readings or disable meter tracking for decommissioned assets"
  },
  {
    code: "RETIRED_ASSET_WITH_PM",
    severity: "HIGH",
    domain: "assets",
    entityType: "Asset",
    message: "Retired asset still has active PM schedules",
    suggestedAction: "Deactivate PM schedules for retired assets"
  },
  {
    code: "INACTIVE_TECH_WITH_JOBS",
    severity: "HIGH",
    domain: "workforce",
    entityType: "User",
    message: "Inactive technician still assigned to open work orders",
    suggestedAction: "Reassign open work orders to active technicians"
  },
  {
    code: "ERP_MAPPING_ERROR",
    severity: "HIGH",
    domain: "erp",
    entityType: "SparePart",
    message: "Active spare part has invalid or broken ERP item mapping",
    suggestedAction: "Re-map or remove the ERP code for the affected parts"
  },
  {
    code: "EXPIRED_COMPLIANCE",
    severity: "HIGH",
    domain: "compliance",
    entityType: "Vehicle",
    message: "Vehicle compliance document expired",
    suggestedAction: "Renew expired documents and update expiry dates"
  },
  {
    code: "FLEET_NO_ASSET_LINK",
    severity: "WARNING",
    domain: "fleet",
    entityType: "Vehicle",
    message: "Vehicle record is not linked to an asset registry entry",
    suggestedAction: "Link each vehicle to its corresponding asset record"
  },
  {
    code: "ERP_UNMAPPED_PARTS",
    severity: "WARNING",
    domain: "erp",
    entityType: "SparePart",
    message: "Active spare parts with no ERP item code",
    suggestedAction: "Map spare parts to ERP item codes or mark as non-ERP items"
  },
  {
    code: "MISSING_LOCATION",
    severity: "WARNING",
    domain: "assets",
    entityType: "Asset",
    message: "Asset missing physical location assignment",
    suggestedAction: "Assign a functional location to each asset"
  },
  {
    code: "MISSING_CRITICALITY",
    severity: "WARNING",
    domain: "assets",
    entityType: "Asset",
    message: "Asset missing criticality classification",
    suggestedAction: "Classify asset criticality (CRITICAL/HIGH/MEDIUM/LOW)"
  },
  {
    code: "MISSING_PM_CHECKLIST",
    severity: "WARNING",
    domain: "maintenance",
    entityType: "MaintenancePlan",
    message: "PM schedule has no checklist items defined",
    suggestedAction: "Add checklist items to PM schedules"
  },
  {
    code: "MISSING_RCA",
    severity: "WARNING",
    domain: "work-orders",
    entityType: "WorkOrder",
    message: "Closed corrective work order with no root cause analysis",
    suggestedAction: "Complete RCA for corrective maintenance work orders"
  },
  {
    code: "APPROVAL_RULE_NO_APPROVERS",
    severity: "WARNING",
    domain: "approvals",
    entityType: "ApprovalRule",
    message: "Active approval rule has no approver levels configured",
    suggestedAction: "Add approver levels to the approval rule"
  },
  {
    code: "STALE_MILEAGE",
    severity: "INFO",
    domain: "fleet",
    entityType: "Vehicle",
    message: "Vehicle mileage not updated in the last 30 days",
    suggestedAction: "Log current mileage reading"
  }
];
