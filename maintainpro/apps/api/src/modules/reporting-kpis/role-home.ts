/**
 * Phase 13 — Role Home Profiles
 *
 * Each profile defines the quick-action cards shown on the Home (Action Center)
 * page for a given role archetype. Cards link to EXISTING routes only.
 *
 * resolveRoleHome() is the single entry point — it maps platform role names to
 * archetypes. ADMIN/SUPER_ADMIN default to MANAGER (broadest operational view).
 * VIEWER/AUDITOR/FINANCE get a read-only MANAGEMENT_VIEWER archetype.
 *
 * Note on overdue links: /work-orders does not expose a stable ?status=OVERDUE
 * query param (overdue is derived, not a stored status). Links use the base
 * /work-orders route; the existing queue engine (QueuesModule) provides the
 * derived overdue queue — frontend should apply queue=overdue if supported.
 */

export type RoleHomeCard = {
  id: string;
  title: string;
  href: string;
  description: string;
  /** KPI codes to surface as a compact badge on this card, if supported by UI. */
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
      {
        id: "report-issue",
        title: "Report Issue",
        href: "/qr/report-issue",
        description: "Raise a maintenance request via QR or form"
      },
      {
        id: "new-request",
        title: "New Request",
        href: "/requests/new",
        description: "Submit a structured maintenance request"
      },
      {
        id: "my-requests",
        title: "My Requests",
        href: "/requests",
        description: "Track requests you raised"
      }
    ]
  },
  {
    roleKey: "TECHNICIAN",
    title: "My Work",
    cards: [
      {
        id: "my-jobs",
        title: "My Jobs",
        href: "/work-orders/my",
        description: "Work orders assigned to you"
      },
      {
        id: "due-today",
        title: "Due Today",
        href: "/work-orders?due=today",
        description: "Jobs due today"
      },
      {
        id: "overdue",
        title: "Overdue",
        href: "/work-orders",
        description: "Past-due open jobs (apply queue=overdue filter)"
      },
      {
        id: "waiting-parts",
        title: "Waiting Parts",
        href: "/work-orders?status=ON_HOLD",
        description: "Jobs blocked on parts"
      },
      {
        id: "evidence",
        title: "Evidence Needed",
        href: "/work-orders",
        description: "Jobs needing photos or evidence uploads"
      }
    ]
  },
  {
    roleKey: "SUPERVISOR",
    title: "Supervisor Home",
    cards: [
      {
        id: "new-requests",
        title: "New Requests",
        href: "/requests",
        description: "Incoming requests awaiting triage"
      },
      {
        id: "unassigned",
        title: "Unassigned",
        href: "/work-orders?unassigned=1",
        description: "Open work orders needing a technician"
      },
      {
        id: "critical",
        title: "Critical",
        href: "/work-orders?priority=CRITICAL",
        description: "Critical-priority open work"
      },
      {
        id: "overdue",
        title: "Overdue",
        href: "/work-orders",
        description: "Past-due non-terminal WOs (apply queue=overdue filter)"
      },
      {
        id: "approvals",
        title: "Approvals",
        href: "/approvals",
        description: "Pending approvals inbox"
      },
      {
        id: "pm-due",
        title: "PM Due",
        href: "/maintenance/plans",
        description: "Preventive maintenance due list"
      }
    ]
  },
  {
    roleKey: "FLEET",
    title: "Fleet Home",
    cards: [
      {
        id: "fleet-overview",
        title: "Fleet",
        href: "/fleet",
        description: "Fleet overview and status"
      },
      {
        id: "service-due",
        title: "Service Due",
        href: "/vehicles",
        description: "Vehicles needing service"
      },
      {
        id: "doc-expiry",
        title: "Document Expiry",
        href: "/compliance",
        description: "Insurance, licence and compliance expiry"
      },
      {
        id: "blocks",
        title: "Vehicle Blocks",
        href: "/fleet/gate",
        description: "Gate blocks and overrides"
      },
      {
        id: "claims-fines",
        title: "Claims / Fines",
        href: "/insurance-claims",
        description: "Open insurance claims and traffic fines"
      },
      {
        id: "accidents",
        title: "Accidents",
        href: "/accidents",
        description: "Reported accidents"
      }
    ]
  },
  {
    roleKey: "MANAGER",
    title: "Manager Home",
    cards: [
      {
        id: "kpi-reports",
        title: "KPI Reports",
        href: "/reports",
        description: "Maintenance and fleet KPI dashboard",
        kpiCodes: ["WO_OVERDUE", "PM_COMPLIANCE", "MTTR", "MTBF"]
      },
      {
        id: "backlog",
        title: "Backlog",
        href: "/work-orders",
        description: "Open work order backlog",
        kpiCodes: ["WO_BACKLOG"]
      },
      {
        id: "pm-compliance",
        title: "PM Compliance",
        href: "/reports",
        description: "Preventive maintenance compliance",
        kpiCodes: ["PM_COMPLIANCE"]
      },
      {
        id: "downtime",
        title: "Downtime",
        href: "/reports",
        description: "Asset downtime hours",
        kpiCodes: ["DOWNTIME", "AVAILABILITY"]
      },
      {
        id: "cost",
        title: "Maintenance Cost",
        href: "/reports",
        description: "Period maintenance spend",
        kpiCodes: ["MAINTENANCE_COST", "COST_PER_KM"]
      },
      {
        id: "repeat-failures",
        title: "Repeat Failures",
        href: "/reports",
        description: "Assets with recurring problems",
        kpiCodes: ["REPEAT_FAILURE"]
      },
      {
        id: "management-intel",
        title: "Management Intelligence",
        href: "/reports/management-intelligence",
        description: "Executive-level operational intelligence"
      }
    ]
  },
  {
    roleKey: "MANAGEMENT_VIEWER",
    title: "Reports",
    cards: [
      {
        id: "reports-overview",
        title: "All Reports",
        href: "/reports",
        description: "Operational reports (read-only)"
      },
      {
        id: "management-intel",
        title: "Management Intelligence",
        href: "/reports/management-intelligence",
        description: "Executive metrics and trends"
      },
      {
        id: "fleet-reports",
        title: "Fleet Reports",
        href: "/reports",
        description: "Fleet cost and compliance reports"
      },
      {
        id: "compliance-reports",
        title: "Compliance",
        href: "/compliance",
        description: "Compliance status overview"
      }
    ]
  }
];

const PROFILE_MAP = new Map<RoleHomeProfileKey, RoleHomeProfile>(
  ROLE_HOME_PROFILES.map((p) => [p.roleKey, p])
);

function getProfile(key: RoleHomeProfileKey): RoleHomeProfile {
  return PROFILE_MAP.get(key)!;
}

/**
 * Resolves a platform role name to a Role Home profile archetype.
 *
 * Mapping:
 *   TECHNICIAN / MECHANIC                          → TECHNICIAN
 *   SUPERVISOR / MAINTENANCE_SUPERVISOR            → SUPERVISOR
 *   FLEET_MANAGER / DRIVER / SECURITY_OFFICER      → FLEET
 *   MANAGER / MAINTENANCE_MANAGER / OPERATIONS_MANAGER / ADMIN / SUPER_ADMIN → MANAGER
 *   VIEWER / AUDITOR / FINANCE / FINANCE_APPROVER  → MANAGEMENT_VIEWER
 *   Everything else (REQUESTER, VENDOR, unknown)   → REQUESTER
 *
 * ADMIN and SUPER_ADMIN default to MANAGER for the broadest operational view.
 */
export function resolveRoleHome(roleName: string | null | undefined): RoleHomeProfile {
  const role = String(roleName ?? "").toUpperCase().trim();

  if (["TECHNICIAN", "MECHANIC"].includes(role)) {
    return getProfile("TECHNICIAN");
  }
  if (["SUPERVISOR", "MAINTENANCE_SUPERVISOR"].includes(role)) {
    return getProfile("SUPERVISOR");
  }
  if (["FLEET_MANAGER", "DRIVER", "SECURITY_OFFICER"].includes(role)) {
    return getProfile("FLEET");
  }
  if (
    [
      "MANAGER",
      "MAINTENANCE_MANAGER",
      "OPERATIONS_MANAGER",
      "ASSET_MANAGER",
      "ADMIN",
      "SUPER_ADMIN"
    ].includes(role)
  ) {
    return getProfile("MANAGER");
  }
  if (["VIEWER", "AUDITOR", "FINANCE", "FINANCE_APPROVER"].includes(role)) {
    return getProfile("MANAGEMENT_VIEWER");
  }

  // Default for REQUESTER, VENDOR, unknown roles
  return getProfile("REQUESTER");
}
