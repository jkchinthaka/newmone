import { extractRoleName } from "./role-redirect";

export const ADMIN_CONSOLE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

export type AdminSectionStatus = "available" | "coming-soon" | "requires-api";

export type AdminConsoleSection = {
  id: string;
  title: string;
  description: string;
  status: AdminSectionStatus;
  statusLabel: string;
  href?: string;
  technicalOnly?: boolean;
};

export function isAdminConsoleRole(roleName: string | null | undefined): boolean {
  const role = extractRoleName(roleName);
  return role != null && (ADMIN_CONSOLE_ROLES as readonly string[]).includes(role);
}

/**
 * Phase 1 — Business Maintenance Administration landing.
 * Software-delivery / go-live / QA clutter removed from normal Admin.
 * Technical concerns live under Technical Admin (/system-health).
 */
export function getAdminConsoleSections(): AdminConsoleSection[] {
  return [
    {
      id: "overview",
      title: "Admin Overview",
      description: "Users, critical jobs, overdue work, approvals, and data-quality health.",
      status: "available",
      statusLabel: "Operations",
      href: "/admin"
    },
    {
      id: "users-access",
      title: "Users",
      description: "Logins, roles and access. Invite people here.",
      status: "available",
      statusLabel: "Access",
      href: "/admin/users"
    },
    {
      id: "roles-permissions",
      title: "Roles & permissions",
      description: "What each role can see and do (permission groups).",
      status: "available",
      statusLabel: "RBAC",
      href: "/admin/roles"
    },
    {
      id: "people-access",
      title: "Employees & technicians",
      description: "Staff records used to assign jobs. Link each to a login.",
      status: "available",
      statusLabel: "Access",
      href: "/admin/people"
    },
    {
      id: "invitations-onboarding",
      title: "Invitations",
      description: "Review and create user invitations.",
      status: "available",
      statusLabel: "Onboarding",
      href: "/admin/invitations"
    },
    {
      id: "organization",
      title: "Sites & locations",
      description: "Company, sites, buildings and rooms.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/organization"
    },
    {
      id: "departments",
      title: "Departments",
      description: "Teams and cost centres.",
      status: "available",
      statusLabel: "Master data",
      href: "/master-data/departments"
    },
    {
      id: "maintenance-config",
      title: "Categories & priorities",
      description: "Job types, categories and response-time targets.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/maintenance-config"
    },
    {
      id: "job-categories",
      title: "Job Categories",
      description: "Machinery / Service / Vehicle main and sub categories.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/job-categories"
    },
    {
      id: "priority-sla",
      title: "Priority & Response Time Rules",
      description: "Response and completion targets by priority.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/priority-sla"
    },
    {
      id: "fault-codes",
      title: "Fault / cause / remedy",
      description: "Codes technicians pick when closing a job.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/fault-codes"
    },
    {
      id: "reason-codes",
      title: "Hold reasons",
      description: "Why a job can be paused.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/reason-codes"
    },
    {
      id: "config-history",
      title: "Configuration History",
      description: "Versioned before/after trail for policy and master-data changes.",
      status: "available",
      statusLabel: "Governance",
      href: "/admin/config-history"
    },
    {
      id: "checklist-templates",
      title: "Procedures",
      description: "Checklists technicians follow on a job.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/checklist-templates"
    },
    {
      id: "maintenance-templates",
      title: "Maintenance Templates",
      description: "Versioned job templates with frozen work-order snapshots.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/maintenance-templates"
    },
    {
      id: "feature-flags",
      title: "Feature Flags",
      description: "Enable or disable tenant modules and capabilities.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/feature-flags"
    },
    {
      id: "warranties",
      title: "Warranties & claims",
      description: "Coverage and claim workflow.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/warranties"
    },
    {
      id: "approvals",
      title: "Approval Rules",
      description: "Configurable multi-level approval policies.",
      status: "available",
      statusLabel: "Control",
      href: "/admin/approval-rules"
    },
    {
      id: "asset-masters",
      title: "Asset types",
      description: "Categories and fields for machines and equipment.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/asset-masters"
    },
    {
      id: "fleet-setup",
      title: "Fleet",
      description: "Vehicles and their documents.",
      status: "available",
      statusLabel: "Fleet",
      href: "/vehicles"
    },
    {
      id: "vendors-contracts",
      title: "Vendors",
      description: "Suppliers and repair contacts.",
      status: "available",
      statusLabel: "Vendors",
      href: "/procurement/vendors"
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Notification inbox and channel readiness.",
      status: "available",
      statusLabel: "Notifications",
      href: "/notifications"
    },
    {
      id: "erp-parts",
      title: "ERP & Spare Parts",
      description: "Bileeta mapping, sync, and reconciliation.",
      status: "available",
      statusLabel: "ERP",
      href: "/erp"
    },
    {
      id: "audit-log",
      title: "Audit Logs",
      description: "Filterable audit trail for admin and override actions.",
      status: "available",
      statusLabel: "Governance",
      href: "/admin/audit"
    },
    {
      id: "data-quality",
      title: "Data Quality",
      description: "Missing fields, unassigned jobs, overdue work, ERP mapping gaps.",
      status: "available",
      statusLabel: "Governance",
      href: "/admin/data-quality"
    },
    {
      id: "bulk-imports",
      title: "Import / Export",
      description: "Upload → Validate → Preview → Confirm → Import → Audit.",
      status: "available",
      statusLabel: "SUPER_ADMIN",
      href: "/admin/bulk-imports"
    },
    {
      id: "security",
      title: "Security settings",
      description: "Sessions, audit log and sign-in rules.",
      status: "available",
      statusLabel: "Security",
      href: "/admin/security"
    },
    {
      id: "integrations",
      title: "Integrations (Technical)",
      description: "Provider readiness for ERP, email, SMS, storage, and queues — Technical Admin only.",
      status: "available",
      statusLabel: "Technical",
      href: "/system-health",
      technicalOnly: true
    },
    {
      id: "technical",
      title: "System Health",
      description: "API, DB, queues, storage, ERP, email/SMS — no secrets exposed.",
      status: "available",
      statusLabel: "Technical",
      href: "/system-health",
      technicalOnly: true
    }
  ];
}

export function adminConsoleSectionsHaveMetricCounts(sections: AdminConsoleSection[]): boolean {
  return sections.some((section) =>
    Object.keys(section as Record<string, unknown>).some((key) =>
      /count|total|metric|users?Total|tenantTotal/i.test(key)
    )
  );
}

export type AdminCommandGroup = {
  id: string;
  title: string;
  advanced: boolean;
  sectionIds: string[];
};

export const ADMIN_COMMAND_GROUPS: AdminCommandGroup[] = [
  { id: "people", title: "People", advanced: false, sectionIds: ["users-access", "roles-permissions", "people-access"] },
  { id: "organization", title: "Company", advanced: false, sectionIds: ["organization", "departments"] },
  { id: "maintenance", title: "Job setup", advanced: false, sectionIds: ["maintenance-config", "fault-codes", "reason-codes", "checklist-templates"] },
  { id: "assets", title: "Assets & vendors", advanced: false, sectionIds: ["asset-masters", "fleet-setup", "vendors-contracts", "warranties"] },
  { id: "security", title: "Security", advanced: false, sectionIds: ["security"] },
  {
    id: "system",
    title: "More settings",
    advanced: true,
    sectionIds: [
      "invitations-onboarding",
      "job-categories",
      "priority-sla",
      "maintenance-templates",
      "approvals",
      "notifications",
      "feature-flags",
      "audit-log",
      "config-history",
      "data-quality"
    ]
  },
  { id: "technical", title: "Technical / Advanced", advanced: true, sectionIds: ["integrations", "technical", "erp-parts", "bulk-imports"] }
];

// Three everyday actions only; everything else is one click away in the cards below.
export const ADMIN_QUICK_ACTIONS = [
  { id: "invite", label: "+ Invite user", href: "/admin/invitations?create=1" },
  { id: "location", label: "+ Add location", href: "/admin/organization" },
  { id: "assets", label: "+ Add asset", href: "/admin/assets/new" }
] as const;

export function adminCommandGroups(roleName: string | null) {
  const showTechnical = roleName === "SUPER_ADMIN";
  const byId = new Map(getAdminConsoleSections().map((section) => [section.id, section]));
  return ADMIN_COMMAND_GROUPS.map((group) => ({
    ...group,
    sections: group.sectionIds
      .map((id) => byId.get(id))
      .filter((section): section is AdminConsoleSection => Boolean(section))
      .filter((section) => showTechnical || !section.technicalOnly)
  })).filter((group) => group.sections.length > 0);
}

export function searchAdminModules(query: string, roleName: string | null): AdminConsoleSection[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  return adminCommandGroups(roleName)
    .flatMap((group) => group.sections)
    .filter((section) => `${section.title} ${section.description}`.toLowerCase().includes(term));
}
