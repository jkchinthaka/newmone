export type AdminNavSection = {
  id: string;
  title: string;
  description: string;
  href?: string;
  technicalOnly?: boolean;
};

/** Operational Maintenance Administration structure (replaces software-delivery-centric console). */
export const MAINTENANCE_ADMIN_SECTIONS: AdminNavSection[] = [
  { id: "overview", title: "Overview", description: "Configuration and data-quality health", href: "/admin" },
  {
    id: "organization",
    title: "Organization",
    description: "Organization, sites, departments, areas, lines, functional locations",
    href: "/admin/organization"
  },
  {
    id: "assets-master",
    title: "Assets & Master Data",
    description: "Domains, categories, types, assets, meters, bulk import/edit, QR labels",
    href: "/admin/assets"
  },
  {
    id: "people-access",
    title: "People & Access",
    description: "People, users, technicians, teams, roles, permissions",
    href: "/admin/people"
  },
  {
    id: "maintenance-setup",
    title: "Maintenance Setup",
    description: "Work types, priorities, SLA, failure/cause/remedy codes, PM/checklists/inspections/calibration",
    href: "/admin/maintenance-setup"
  },
  {
    id: "approvals",
    title: "Approvals",
    description: "Rules, levels, thresholds, approvers, escalations",
    href: "/admin/approvals"
  },
  {
    id: "fleet-setup",
    title: "Fleet Setup",
    description: "Vehicle types, service types, inspection templates, document/fine types, insurers",
    href: "/admin/fleet-setup"
  },
  {
    id: "vendors-contracts",
    title: "Vendors & Contracts",
    description: "Vendors, contacts, AMC/service contracts",
    href: "/admin/vendors"
  },
  {
    id: "erp-parts",
    title: "ERP & Spare Parts",
    description: "Item mapping, sync runs, reconciliation (Bileeta boundary)",
    href: "/erp"
  },
  {
    id: "notifications",
    title: "Notifications & Escalations",
    description: "Notification channels and escalation rules",
    href: "/admin/notifications"
  },
  {
    id: "data-quality",
    title: "Data Quality",
    description: "Duplicates, missing fields, stale meters, ERP mapping errors",
    href: "/operations/exceptions"
  },
  {
    id: "audit-log",
    title: "Audit Log",
    description: "Read-only filterable audit trail",
    href: "/admin/audit"
  },
  {
    id: "technical",
    title: "Technical Administration",
    description: "API, DB, queue, storage, ERP, email/SMS, backups, errors, app version",
    href: "/admin/system-health",
    technicalOnly: true
  }
];

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
  | "EXPIRED_COMPLIANCE";

export const DATA_QUALITY_RULES: Array<{ code: DataQualityFindingCode; severity: "HIGH" | "MEDIUM" | "LOW" }> = [
  { code: "DUPLICATE_ASSETS", severity: "HIGH" },
  { code: "MISSING_LOCATION", severity: "MEDIUM" },
  { code: "MISSING_CRITICALITY", severity: "MEDIUM" },
  { code: "STALE_METER", severity: "HIGH" },
  { code: "MISSING_PM_CHECKLIST", severity: "MEDIUM" },
  { code: "RETIRED_ASSET_WITH_PM", severity: "HIGH" },
  { code: "INACTIVE_TECH_WITH_JOBS", severity: "HIGH" },
  { code: "MISSING_RCA", severity: "MEDIUM" },
  { code: "ERP_MAPPING_ERROR", severity: "HIGH" },
  { code: "STALE_MILEAGE", severity: "MEDIUM" },
  { code: "EXPIRED_COMPLIANCE", severity: "HIGH" }
];
