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
 * Operational Maintenance Administration console (Phase 12).
 * Prefers operational configuration over software-delivery go-live modules.
 */
export function getAdminConsoleSections(): AdminConsoleSection[] {
  return [
    {
      id: "overview",
      title: "Overview",
      description: "Configuration and data-quality health for maintenance operations.",
      status: "available",
      statusLabel: "Operations",
      href: "/admin"
    },
    {
      id: "organization",
      title: "Organization",
      description: "Organization, sites, departments, areas, lines, and functional locations.",
      status: "available",
      statusLabel: "Master data",
      href: "/master-data/departments"
    },
    {
      id: "assets-master",
      title: "Assets & Master Data",
      description: "Domains, categories, assets, meters, bulk import/edit, and QR labels.",
      status: "available",
      statusLabel: "Assets",
      href: "/assets"
    },
    {
      id: "people-access",
      title: "People & Access",
      description: "People, users, technicians, teams, roles, and permissions.",
      status: "available",
      statusLabel: "Full onboarding",
      href: "/admin/people"
    },
    {
      id: "users-access",
      title: "Users & Access",
      description: "Review users, roles, tenant association, and safe deactivate/reactivate.",
      status: "available",
      statusLabel: "Access control",
      href: "/admin/users"
    },
    {
      id: "roles-permissions",
      title: "Roles & Permissions",
      description: "Role and permission coverage matrix.",
      status: "available",
      statusLabel: "RBAC",
      href: "/admin/roles"
    },
    {
      id: "maintenance-setup",
      title: "Maintenance Setup",
      description: "Work types, priorities, SLA, failure/cause/remedy codes, PM and checklists.",
      status: "available",
      statusLabel: "Setup",
      href: "/domain-coverage"
    },
    {
      id: "fleet-setup",
      title: "Fleet Setup",
      description: "Vehicle types, service/document types, fines, and insurers.",
      status: "available",
      statusLabel: "Fleet",
      href: "/vehicles"
    },
    {
      id: "vendors-contracts",
      title: "Vendors & Contracts",
      description: "Vendors, contacts, and AMC/service contracts.",
      status: "available",
      statusLabel: "Vendors",
      href: "/procurement"
    },
    {
      id: "erp-parts",
      title: "ERP & Spare Parts",
      description: "Bileeta mapping, sync runs, reconciliation (MaintainPro does not own stock truth).",
      status: "available",
      statusLabel: "Integration",
      href: "/erp"
    },
    {
      id: "bulk-imports",
      title: "Bulk Imports",
      description: "Upload → Validate → Preview → Errors → Confirm → Import → Audit. Never write unvalidated rows.",
      status: "available",
      statusLabel: "SUPER_ADMIN only",
      href: "/admin/bulk-imports"
    },
    {
      id: "data-quality",
      title: "Data Quality",
      description: "Duplicates, missing location/criticality, stale meters, inactive tech with jobs, ERP errors.",
      status: "available",
      statusLabel: "Exceptions",
      href: "/operations/exceptions"
    },
    {
      id: "audit-log",
      title: "Audit Log",
      description: "Read-only filterable audit of actor, entity, action, before/after values.",
      status: "available",
      statusLabel: "Audit",
      href: "/settings"
    },
    {
      id: "technical",
      title: "Technical Administration",
      description: "API, DB, queue, storage, ERP, email/SMS, backups, errors, app version.",
      status: "available",
      statusLabel: "Technical",
      href: "/system-health",
      technicalOnly: true
    },
    {
      id: "tenants",
      title: "Tenants",
      description: "Tenant context and readiness (SUPER_ADMIN).",
      status: "available",
      statusLabel: "Tenancy",
      href: "/admin/tenants"
    },
    {
      id: "invitations-onboarding",
      title: "Invitations",
      description: "Controlled tenant invitations.",
      status: "available",
      statusLabel: "Onboarding",
      href: "/admin/invitations"
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
