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
};

export function isAdminConsoleRole(roleName: string | null | undefined): boolean {
  const role = extractRoleName(roleName);
  return role != null && (ADMIN_CONSOLE_ROLES as readonly string[]).includes(role);
}

/**
 * Read-only admin console sections. No user/tenant/RBAC counts are included.
 * Links only point at routes that exist today.
 */
export function getAdminConsoleSections(): AdminConsoleSection[] {
  return [
    {
      id: "users-access",
      title: "Users & Access",
      description: "Review users, roles, tenant association, and access status in a read-only admin view.",
      status: "available",
      statusLabel: "Read-only review",
      href: "/admin/users"
    },
    {
      id: "tenants",
      title: "Tenants",
      description:
        "Cross-tenant administration and tenant lifecycle controls require a dedicated admin API. No tenant counts are shown here.",
      status: "requires-api",
      statusLabel: "Requires API"
    },
    {
      id: "roles-permissions",
      title: "Roles & Permissions",
      description:
        "Inspect role definitions and permission catalogs. Role/permission mutation flows remain deferred from this foundation pass.",
      status: "available",
      statusLabel: "Settings · Roles",
      href: "/settings"
    },
    {
      id: "system-health",
      title: "System Health",
      description: "Operational readiness, dependency checks, replication status, and integration modes.",
      status: "available",
      statusLabel: "Live readiness",
      href: "/system-health"
    },
    {
      id: "audit-security",
      title: "Audit & Security",
      description:
        "Review audit history and security-sensitive changes through existing settings views until a dedicated admin audit workspace ships.",
      status: "available",
      statusLabel: "Settings · Audit",
      href: "/settings"
    },
    {
      id: "integrations",
      title: "Integrations",
      description:
        "Email, SMS, ERP, billing, and storage integration readiness is surfaced through system health checks today.",
      status: "available",
      statusLabel: "Readiness checks",
      href: "/system-health"
    },
    {
      id: "notifications-dispatch",
      title: "Notifications / Email / SMS",
      description:
        "Dispatch modes and queue health are visible in system health. Dedicated notification admin controls are not connected yet.",
      status: "available",
      statusLabel: "System health",
      href: "/system-health"
    },
    {
      id: "environment-readiness",
      title: "Environment Readiness",
      description:
        "Environment configuration, required dependencies, and deployment readiness signals from the existing readiness endpoint.",
      status: "available",
      statusLabel: "Readiness endpoint",
      href: "/system-health"
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
