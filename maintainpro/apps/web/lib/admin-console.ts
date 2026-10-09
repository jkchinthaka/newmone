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
      description: "Search, invite, disable/enable, and access review.",
      status: "available",
      statusLabel: "Access",
      href: "/admin/users"
    },
    {
      id: "roles-permissions",
      title: "Roles & Permissions",
      description: "Role coverage matrix and permission groupings.",
      status: "available",
      statusLabel: "RBAC",
      href: "/admin/roles"
    },
    {
      id: "people-access",
      title: "People & Workforce",
      description: "People, technicians, and employee mapping.",
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
      title: "Organization",
      description: "Company, sites, and functional location hierarchy.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/organization"
    },
    {
      id: "departments",
      title: "Departments",
      description: "Business department master.",
      status: "available",
      statusLabel: "Master data",
      href: "/master-data/departments"
    },
    {
      id: "maintenance-config",
      title: "Maintenance Configuration",
      description: "Job domains, categories, priorities, and related setup.",
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
      title: "Priority / SLA Rules",
      description: "Response and completion targets by priority.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/priority-sla"
    },
    {
      id: "fault-codes",
      title: "Fault / Cause / Remedy",
      description: "Admin-managed failure, cause, and remedy codes.",
      status: "available",
      statusLabel: "Setup",
      href: "/admin/fault-codes"
    },
    {
      id: "reason-codes",
      title: "Hold / Delay Reasons",
      description: "Structured pause reasons for work orders.",
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
      title: "Checklist Templates",
      description: "Versioned PM/WO checklists with execution snapshots.",
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
      title: "Warranties & Claims",
      description: "Coverage and recovery claim workflow.",
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
      href: "/admin/approvals"
    },
    {
      id: "asset-masters",
      title: "Asset Configuration",
      description: "Domains, categories, types, and attribute definitions.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/asset-masters"
    },
    {
      id: "fleet-setup",
      title: "Fleet Configuration",
      description: "Vehicles, documents, and fleet administration.",
      status: "available",
      statusLabel: "Fleet",
      href: "/vehicles"
    },
    {
      id: "vendors-contracts",
      title: "Vendors",
      description: "Suppliers and vendor repair context.",
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
      title: "Security Settings",
      description: "Access, roles, audit, and session posture.",
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
  { id: "people", title: "People & Access", advanced: false, sectionIds: ["users-access", "invitations-onboarding", "roles-permissions", "security"] },
  { id: "organization", title: "Organization", advanced: false, sectionIds: ["organization", "departments", "people-access"] },
  { id: "maintenance", title: "Maintenance Setup", advanced: false, sectionIds: ["maintenance-config", "job-categories", "priority-sla", "fault-codes", "reason-codes", "maintenance-templates", "checklist-templates"] },
  { id: "assets", title: "Assets & Fleet", advanced: false, sectionIds: ["asset-masters", "fleet-setup", "vendors-contracts", "warranties"] },
  { id: "system", title: "System", advanced: true, sectionIds: ["notifications", "feature-flags", "audit-log", "config-history", "data-quality", "approvals"] },
  { id: "technical", title: "Technical / Advanced", advanced: true, sectionIds: ["integrations", "technical", "erp-parts", "bulk-imports"] }
];

export const ADMIN_QUICK_ACTIONS = [
  { id: "invite", label: "Invite User", href: "/admin/invitations?create=1" },
  { id: "department", label: "Add Department", href: "/master-data/departments" },
  { id: "vendor", label: "Add Vendor", href: "/procurement/vendors" },
  { id: "role", label: "Create Role", href: "/admin/roles" },
  { id: "location", label: "Add Location", href: "/admin/organization" }
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
