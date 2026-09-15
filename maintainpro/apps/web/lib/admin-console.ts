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
      title: "Overview",
      description: "Configuration and data-quality health for maintenance operations.",
      status: "available",
      statusLabel: "Operations",
      href: "/admin"
    },
    {
      id: "organization",
      title: "Organization",
      description: "Organization, sites, and functional location hierarchy.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/organization"
    },
    {
      id: "asset-masters",
      title: "Asset Masters",
      description: "Domains, categories, types, and attribute definitions for the universal asset registry.",
      status: "available",
      statusLabel: "Master data",
      href: "/admin/asset-masters"
    },
    {
      id: "departments",
      title: "Departments",
      description: "Business department master (separate from physical locations).",
      status: "available",
      statusLabel: "Master data",
      href: "/master-data/departments"
    },
    {
      id: "assets-master",
      title: "Assets registry",
      description: "Universal asset list, QR, bulk import, and lifecycle.",
      status: "available",
      statusLabel: "Assets",
      href: "/assets"
    },
    {
      id: "people-access",
      title: "People & Access",
      description: "People, technicians, users, roles, and invitations.",
      status: "available",
      statusLabel: "Access",
      href: "/admin/people"
    },
    {
      id: "users-access",
      title: "Users",
      description: "Safe deactivate/reactivate and access review.",
      status: "available",
      statusLabel: "Users",
      href: "/admin/users"
    },
    {
      id: "roles-permissions",
      title: "Roles & Permissions",
      description: "Role and permission coverage matrix (read-only review).",
      status: "available",
      statusLabel: "RBAC",
      href: "/admin/roles"
    },
    {
      id: "approvals",
      title: "Approval Matrix",
      description: "Configurable multi-level approval rules for maintenance controls.",
      status: "available",
      statusLabel: "Control",
      href: "/admin/approvals"
    },
    {
      id: "invitations-onboarding",
      title: "Invitations",
      description: "Review and create user invitations for onboarding.",
      status: "available",
      statusLabel: "Onboarding",
      href: "/admin/invitations"
    },
    {
      id: "maintenance-setup",
      title: "Maintenance Setup",
      description: "Job codes, forecasts, and maintenance catalogs (full setup in later phases).",
      status: "available",
      statusLabel: "Setup",
      href: "/maintenance/job-codes"
    },
    {
      id: "fleet-setup",
      title: "Fleet Setup",
      description: "Vehicles, documents, and fleet administration.",
      status: "available",
      statusLabel: "Fleet",
      href: "/vehicles"
    },
    {
      id: "vendors-contracts",
      title: "Vendors & Contracts",
      description: "Suppliers and vendor repair context.",
      status: "available",
      statusLabel: "Vendors",
      href: "/procurement/vendors"
    },
    {
      id: "erp-parts",
      title: "ERP & Spare Parts",
      description: "Bileeta mapping, sync, and reconciliation (MaintainPro does not own stock truth).",
      status: "available",
      statusLabel: "ERP",
      href: "/erp"
    },
    {
      id: "bulk-imports",
      title: "Bulk Imports",
      description: "Upload → Validate → Preview → Confirm → Import → Audit.",
      status: "available",
      statusLabel: "SUPER_ADMIN",
      href: "/admin/bulk-imports"
    },
    {
      id: "data-quality",
      title: "Data Quality",
      description: "Duplicates, missing fields, stale meters, ERP mapping errors, and open exception findings.",
      status: "available",
      statusLabel: "Governance",
      href: "/admin/data-quality"
    },
    {
      id: "notifications",
      title: "Notifications & Escalations",
      description: "Notification inbox and channel readiness.",
      status: "available",
      statusLabel: "Notifications",
      href: "/notifications"
    },
    {
      id: "audit-log",
      title: "Audit",
      description: "Filterable read-only audit trail for all platform actions.",
      status: "available",
      statusLabel: "Governance",
      href: "/admin/audit"
    },
    {
      id: "technical",
      title: "Technical Administration",
      description: "API, DB, queues, storage, ERP, email/SMS, backups, errors, app version.",
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
