/**
 * Phase 13 — Client-side Role Home resolution
 *
 * Mirrors the backend resolveRoleHome() for instant card rendering without an
 * API round-trip. The backend remains authoritative; this file is kept in sync.
 *
 * For KPI tooltip text (formulaSummary), fetch definitions from the API via
 * fetchKpiDefinitions() rather than duplicating formula strings here.
 */

export type RoleHomeCard = {
  id: string;
  title: string;
  href: string;
  description: string;
  kpiCodes?: string[];
};

export type RoleHomeProfileKey =
  | "REQUESTER"
  | "TECHNICIAN"
  | "SUPERVISOR"
  | "FLEET"
  | "MANAGER"
  | "MANAGEMENT_VIEWER";

export type RoleHomeProfile = {
  roleKey: RoleHomeProfileKey;
  title: string;
  cards: RoleHomeCard[];
};

export const ROLE_HOME_PROFILES: RoleHomeProfile[] = [
  {
    roleKey: "REQUESTER",
    title: "Home",
    cards: [
      { id: "report-issue", title: "Report Issue", href: "/qr/report-issue", description: "Raise a maintenance request" },
      { id: "new-request", title: "New Request", href: "/requests/new", description: "Submit a structured request" },
      { id: "my-requests", title: "My Requests", href: "/requests", description: "Track your requests" }
    ]
  },
  {
    roleKey: "TECHNICIAN",
    title: "My Work",
    cards: [
      { id: "my-jobs", title: "My Jobs", href: "/work-orders/my", description: "Work orders assigned to you" },
      { id: "due-today", title: "Due Today", href: "/work-orders?due=today", description: "Jobs due today" },
      { id: "overdue", title: "Overdue", href: "/work-orders", description: "Past-due open jobs" },
      { id: "waiting-parts", title: "Waiting Parts", href: "/work-orders?status=ON_HOLD", description: "Blocked on parts" },
      { id: "evidence", title: "Evidence Needed", href: "/work-orders", description: "Jobs needing photos" }
    ]
  },
  {
    roleKey: "SUPERVISOR",
    title: "Supervisor Home",
    cards: [
      { id: "new-requests", title: "New Requests", href: "/requests", description: "Requests awaiting triage" },
      { id: "unassigned", title: "Unassigned", href: "/work-orders?unassigned=1", description: "Needs technician" },
      { id: "critical", title: "Critical", href: "/work-orders?priority=CRITICAL", description: "Critical priority" },
      { id: "overdue", title: "Overdue", href: "/work-orders", description: "Past-due non-terminal WOs" },
      { id: "approvals", title: "Approvals", href: "/approvals", description: "Pending approvals inbox" },
      { id: "pm-due", title: "PM Due", href: "/maintenance/plans", description: "Preventive due list" }
    ]
  },
  {
    roleKey: "FLEET",
    title: "Fleet Home",
    cards: [
      { id: "fleet-overview", title: "Fleet", href: "/fleet", description: "Fleet status" },
      { id: "service-due", title: "Service Due", href: "/vehicles", description: "Vehicles needing service" },
      { id: "doc-expiry", title: "Document Expiry", href: "/compliance", description: "Insurance/licence expiry" },
      { id: "blocks", title: "Vehicle Blocks", href: "/fleet/gate", description: "Gate blocks / overrides" },
      { id: "claims-fines", title: "Claims / Fines", href: "/insurance-claims", description: "Claims and fines" },
      { id: "accidents", title: "Accidents", href: "/accidents", description: "Reported accidents" }
    ]
  },
  {
    roleKey: "MANAGER",
    title: "Manager Home",
    cards: [
      { id: "kpi-reports", title: "KPI Reports", href: "/reports", description: "Maintenance and fleet KPIs", kpiCodes: ["WO_OVERDUE", "PM_COMPLIANCE", "MTTR", "MTBF"] },
      { id: "backlog", title: "Backlog", href: "/work-orders", description: "Open backlog", kpiCodes: ["WO_BACKLOG"] },
      { id: "pm-compliance", title: "PM Compliance", href: "/reports", description: "PM compliance", kpiCodes: ["PM_COMPLIANCE"] },
      { id: "downtime", title: "Downtime", href: "/reports", description: "Asset downtime", kpiCodes: ["DOWNTIME", "AVAILABILITY"] },
      { id: "cost", title: "Maintenance Cost", href: "/reports", description: "Period spend", kpiCodes: ["MAINTENANCE_COST", "COST_PER_KM"] },
      { id: "repeat-failures", title: "Repeat Failures", href: "/reports", description: "Recurring problems", kpiCodes: ["REPEAT_FAILURE"] },
      { id: "management-intel", title: "Management Intelligence", href: "/reports/management-intelligence", description: "Executive metrics" }
    ]
  },
  {
    roleKey: "MANAGEMENT_VIEWER",
    title: "Reports",
    cards: [
      { id: "reports-overview", title: "All Reports", href: "/reports", description: "Operational reports (read-only)" },
      { id: "management-intel", title: "Management Intelligence", href: "/reports/management-intelligence", description: "Executive metrics" },
      { id: "fleet-reports", title: "Fleet Reports", href: "/reports", description: "Fleet reports" },
      { id: "compliance-reports", title: "Compliance", href: "/compliance", description: "Compliance status" }
    ]
  }
];

const PROFILE_MAP = new Map<RoleHomeProfileKey, RoleHomeProfile>(
  ROLE_HOME_PROFILES.map((p) => [p.roleKey, p])
);

/**
 * Client-side role → profile resolution (mirrors backend resolveRoleHome).
 */
export function resolveRoleHome(roleName: string | null | undefined): RoleHomeProfile {
  const role = String(roleName ?? "").toUpperCase().trim();

  if (["TECHNICIAN", "MECHANIC"].includes(role)) return PROFILE_MAP.get("TECHNICIAN")!;
  if (["SUPERVISOR", "MAINTENANCE_SUPERVISOR"].includes(role)) return PROFILE_MAP.get("SUPERVISOR")!;
  if (["FLEET_MANAGER", "DRIVER", "SECURITY_OFFICER"].includes(role)) return PROFILE_MAP.get("FLEET")!;
  if (["MANAGER", "MAINTENANCE_MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
    return PROFILE_MAP.get("MANAGER")!;
  }
  if (["VIEWER", "AUDITOR", "FINANCE", "FINANCE_APPROVER"].includes(role)) {
    return PROFILE_MAP.get("MANAGEMENT_VIEWER")!;
  }

  return PROFILE_MAP.get("REQUESTER")!;
}
