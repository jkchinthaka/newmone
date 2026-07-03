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
      id: "people-onboarding",
      title: "People & Onboarding",
      description: "Add employees, technician profiles, login access, roles, and secure invitations.",
      status: "available",
      statusLabel: "Full onboarding",
      href: "/admin/people"
    },
    {
      id: "qa-incidents",
      title: "QA & Incidents",
      description: "Software error register, incident lifecycle, RCA, regression tracking, and release quality.",
      status: "available",
      statusLabel: "Quality control",
      href: "/qa"
    },
    {
      id: "delivery-readiness",
      title: "Delivery Readiness",
      description: "Client handover checklist, final QA, security, deployment, backup, and sign-off workflow.",
      status: "available",
      statusLabel: "Handover pack",
      href: "/delivery-readiness"
    },
    {
      id: "post-go-live",
      title: "Post-Go-Live Operations",
      description: "Support tickets, SLA, training, change control, releases, hypercare, and handover.",
      status: "available",
      statusLabel: "Operations",
      href: "/post-go-live"
    },
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
      description: "Review tenant context and tenant readiness in a read-only admin workspace.",
      status: "available",
      statusLabel: "Read-only review",
      href: "/admin/tenants"
    },
    {
      id: "invitations-onboarding",
      title: "Invitations & Onboarding",
      description: "Review onboarding status and create controlled tenant invitations from the admin workspace.",
      status: "available",
      statusLabel: "Review + create",
      href: "/admin/invitations"
    },
    {
      id: "roles-permissions",
      title: "Roles & Permissions",
      description: "Review role and permission coverage in a read-only admin matrix.",
      status: "available",
      statusLabel: "Read-only review",
      href: "/admin/roles"
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
