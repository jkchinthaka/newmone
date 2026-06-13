import {
  resolveDashboardVariant,
  type DashboardVariant
} from "./dashboard-roles";
import { extractRoleName } from "./role-redirect";

export type ActionCenterVariant = DashboardVariant;

export type ActionCenterTone = "neutral" | "info" | "warning" | "danger" | "success";

export type ActionCenterItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone?: ActionCenterTone;
  metricLabel?: string;
  metricValue?: string;
  statusLabel?: string;
};

export type ActionCenterSection = {
  id: string;
  title: string;
  description?: string;
  items: ActionCenterItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

export type ActionCenterWorkOrderStats = {
  open: number;
  inProgress: number;
  overdue: number;
  highPriority: number;
  assigned?: number;
};

export type ActionCenterInventoryStats = {
  lowStockCount: number;
  criticalCount: number;
  pendingPurchaseOrders: number;
};

export type ActionCenterSystemHealthStats = {
  status: "operational" | "degraded";
  failed: number;
  degraded: number;
};

export type ActionCenterInvitationStats = {
  pending: number;
  expired: number;
};

export type ActionCenterFacilityIssueStats = {
  open: number;
  inProgress: number;
  critical: number;
};

export type ActionCenterSnapshot = {
  variant: ActionCenterVariant;
  roleName: string | null;
  workOrders?: ActionCenterWorkOrderStats | null;
  inventory?: ActionCenterInventoryStats | null;
  systemHealth?: ActionCenterSystemHealthStats | null;
  invitations?: ActionCenterInvitationStats | null;
  facilityIssues?: ActionCenterFacilityIssueStats | null;
  connections: {
    workOrders: boolean;
    inventory: boolean;
    systemHealth: boolean;
    invitations: boolean;
    facilityIssues: boolean;
  };
};

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

export function resolveActionCenterVariant(roleName: string | null | undefined): ActionCenterVariant {
  return resolveDashboardVariant(roleName);
}

export function actionCenterShowsSystemHealth(variant: ActionCenterVariant): boolean {
  return variant === "admin";
}

export function actionCenterShowsInvitations(roleName: string | null | undefined): boolean {
  return ADMIN_ROLES.has(extractRoleName(roleName) ?? "");
}

export function actionCenterShowsWorkOrders(variant: ActionCenterVariant): boolean {
  return variant === "admin" || variant === "management" || variant === "technician" || variant === "viewer";
}

export function actionCenterShowsInventory(variant: ActionCenterVariant): boolean {
  return variant === "admin" || variant === "inventory" || variant === "management";
}

export function actionCenterShowsFacilityIssues(variant: ActionCenterVariant, roleName: string | null): boolean {
  const role = extractRoleName(roleName);
  return (
    variant === "cleaner" ||
    variant === "management" ||
    role === "FACILITY_MANAGER" ||
    role === "BUILDING_SUPERVISOR"
  );
}

export function actionCenterShowsDriverLinks(variant: ActionCenterVariant): boolean {
  return variant === "driver";
}

export function actionCenterIsReadOnly(variant: ActionCenterVariant): boolean {
  return variant === "viewer" || variant === "minimal";
}

export function getActionCenterTitle(variant: ActionCenterVariant): string {
  switch (variant) {
    case "admin":
      return "Operations Action Center";
    case "management":
      return "Operations Action Center";
    case "technician":
      return "My Action Center";
    case "inventory":
      return "Inventory Action Center";
    case "cleaner":
      return "Cleaning Action Center";
    case "driver":
      return "Driver Action Center";
    case "viewer":
      return "Read-only Action Center";
    default:
      return "Action Center";
  }
}

export function getActionCenterDescription(variant: ActionCenterVariant): string {
  switch (variant) {
    case "admin":
      return "System readiness, work order pressure, inventory risks, and onboarding attention from live tenant data.";
    case "management":
      return "Overdue work, operational risks, and report shortcuts based on your current modules.";
    case "technician":
      return "Assigned and priority work orders with quick links to your maintenance queue.";
    case "inventory":
      return "Low-stock alerts and procurement attention from live inventory records.";
    case "cleaner":
      return "Facility and cleaning issue workflows available to your role.";
    case "driver":
      return "Vehicle and fleet modules available to drivers.";
    case "viewer":
      return "Read-only operational summaries and report links.";
    default:
      return "Open available modules and report views for your account.";
  }
}

function toneFromCount(count: number, warningAt = 1, dangerAt = 5): ActionCenterTone {
  if (count >= dangerAt) {
    return "danger";
  }

  if (count >= warningAt) {
    return "warning";
  }

  return "success";
}

export function buildActionCenterSections(snapshot: ActionCenterSnapshot): ActionCenterSection[] {
  const sections: ActionCenterSection[] = [];

  if (actionCenterShowsSystemHealth(snapshot.variant)) {
    sections.push(buildSystemHealthSection(snapshot));
    sections.push(buildAdminSecuritySection(snapshot));
  }

  if (actionCenterShowsWorkOrders(snapshot.variant)) {
    sections.push(buildWorkOrdersSection(snapshot));
  }

  if (actionCenterShowsInventory(snapshot.variant)) {
    sections.push(buildInventorySection(snapshot));
  }

  if (actionCenterShowsInvitations(snapshot.roleName)) {
    sections.push(buildInvitationsSection(snapshot));
  }

  if (actionCenterShowsFacilityIssues(snapshot.variant, snapshot.roleName)) {
    sections.push(buildFacilitySection(snapshot));
  }

  if (actionCenterShowsDriverLinks(snapshot.variant)) {
    sections.push(buildDriverSection());
  }

  if (
    snapshot.variant === "admin" ||
    snapshot.variant === "viewer" ||
    snapshot.variant === "minimal" ||
    snapshot.variant === "management"
  ) {
    sections.push(buildReportsSection(snapshot));
  }

  if (snapshot.variant === "minimal") {
    sections.push(buildMinimalSection());
  }

  return sections.filter((section) => section.items.length > 0 || section.emptyTitle);
}

function buildSystemHealthSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  if (!snapshot.connections.systemHealth || !snapshot.systemHealth) {
    return {
      id: "system-health",
      title: "System health",
      description: "Platform readiness checks for administrators.",
      items: [],
      emptyTitle: "Not connected yet",
      emptyDescription: "System health data is unavailable right now. Open System Health to retry."
    };
  }

  const health = snapshot.systemHealth;
  const needsAttention = health.status !== "operational" || health.failed > 0 || health.degraded > 0;

  return {
    id: "system-health",
    title: "System health",
    description: "Platform readiness checks for administrators.",
    items: [
      {
        id: "system-health-overview",
        title: needsAttention ? "Review degraded integrations" : "Platform is operational",
        description: needsAttention
          ? "One or more required checks need administrator review."
          : "All required readiness checks are operational.",
        href: "/system-health",
        tone: needsAttention ? "warning" : "success",
        metricLabel: "Failed checks",
        metricValue: String(health.failed),
        statusLabel: health.status === "operational" ? "Operational" : "Needs attention"
      }
    ]
  };
}

function buildAdminSecuritySection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  return {
    id: "admin-security",
    title: "Admin & security",
    description: "Platform administration shortcuts.",
    items: [
      {
        id: "admin-console",
        title: "Admin console",
        description: "Review users, tenants, roles, and onboarding readiness.",
        href: "/admin",
        tone: "info"
      },
      {
        id: "admin-users",
        title: "Users & access",
        description: "Review active accounts and access posture.",
        href: "/admin/users",
        tone: "neutral"
      }
    ]
  };
}

function buildWorkOrdersSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  if (!snapshot.connections.workOrders || !snapshot.workOrders) {
    return {
      id: "work-orders",
      title: snapshot.variant === "technician" ? "My work orders" : "Work order risks",
      description: "Live maintenance queue signals.",
      items: [],
      emptyTitle: "Not connected yet",
      emptyDescription: "Work order data is unavailable right now."
    };
  }

  const stats = snapshot.workOrders;
  const items: ActionCenterItem[] = [];

  if (snapshot.variant === "technician" && stats.assigned != null) {
    items.push({
      id: "assigned-work",
      title: "Assigned work orders",
      description: "Open jobs assigned to you.",
      href: "/work-orders",
      tone: stats.assigned > 0 ? "info" : "success",
      metricLabel: "Assigned",
      metricValue: String(stats.assigned)
    });
  }

  if (stats.overdue > 0) {
    items.push({
      id: "overdue-work",
      title: "Overdue work orders",
      description: "Jobs past due or with SLA breach flags.",
      href: "/work-orders",
      tone: "danger",
      metricLabel: "Overdue",
      metricValue: String(stats.overdue)
    });
  }

  if (stats.highPriority > 0) {
    items.push({
      id: "priority-work",
      title: "High-priority open work",
      description: "Critical or high priority jobs still open.",
      href: "/work-orders",
      tone: "warning",
      metricLabel: "High priority",
      metricValue: String(stats.highPriority)
    });
  }

  items.push({
    id: "open-work",
    title: "Open maintenance queue",
    description: "Review the full work order board.",
    href: "/work-orders",
    tone: stats.open + stats.inProgress > 0 ? "info" : "success",
    metricLabel: "Open / in progress",
    metricValue: `${stats.open} / ${stats.inProgress}`
  });

  return {
    id: "work-orders",
    title: snapshot.variant === "technician" ? "My work orders" : "Work order risks",
    description: "Live maintenance queue signals.",
    items
  };
}

function buildInventorySection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  if (!snapshot.connections.inventory || !snapshot.inventory) {
    return {
      id: "inventory",
      title: "Inventory & procurement",
      description: "Stock and purchase order attention.",
      items: [],
      emptyTitle: "Not connected yet",
      emptyDescription: "Inventory data is unavailable right now."
    };
  }

  const stats = snapshot.inventory;
  const items: ActionCenterItem[] = [];

  if (stats.lowStockCount > 0) {
    items.push({
      id: "low-stock",
      title: "Low-stock parts",
      description: "Review replenishment before jobs stall.",
      href: "/inventory",
      tone: toneFromCount(stats.lowStockCount, 1, 3),
      metricLabel: "Low stock",
      metricValue: String(stats.lowStockCount)
    });
  }

  if (stats.criticalCount > 0) {
    items.push({
      id: "critical-stock",
      title: "Critical stock levels",
      description: "Parts at critical thresholds need immediate review.",
      href: "/inventory",
      tone: "danger",
      metricLabel: "Critical",
      metricValue: String(stats.criticalCount)
    });
  }

  if (stats.pendingPurchaseOrders > 0) {
    items.push({
      id: "pending-pos",
      title: "Pending purchase orders",
      description: "Open procurement requests awaiting progress.",
      href: "/procurement",
      tone: stats.pendingPurchaseOrders > 0 ? "warning" : "neutral",
      metricLabel: "Pending POs",
      metricValue: String(stats.pendingPurchaseOrders)
    });
  }

  if (items.length === 0) {
    items.push({
      id: "inventory-healthy",
      title: "Inventory looks stable",
      description: "No low-stock or pending procurement alerts returned right now.",
      href: "/inventory",
      tone: "success"
    });
  }

  return {
    id: "inventory",
    title: "Inventory & procurement",
    description: "Stock and purchase order attention.",
    items
  };
}

function buildInvitationsSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  if (!snapshot.connections.invitations || !snapshot.invitations) {
    return {
      id: "invitations",
      title: "Onboarding & invitations",
      description: "Pending invitation review for administrators.",
      items: [],
      emptyTitle: "Not connected yet",
      emptyDescription: "Invitation review data is unavailable right now."
    };
  }

  const stats = snapshot.invitations;
  const items: ActionCenterItem[] = [];

  if (stats.pending > 0) {
    items.push({
      id: "pending-invites",
      title: "Pending invitations",
      description: "Review outstanding onboarding invitations.",
      href: "/admin/invitations",
      tone: toneFromCount(stats.pending, 1, 5),
      metricLabel: "Pending",
      metricValue: String(stats.pending)
    });
  }

  if (stats.expired > 0) {
    items.push({
      id: "expired-invites",
      title: "Expired invitations",
      description: "Expired invites may need follow-up or re-issue.",
      href: "/admin/invitations",
      tone: "warning",
      metricLabel: "Expired",
      metricValue: String(stats.expired)
    });
  }

  if (items.length === 0) {
    items.push({
      id: "invites-clear",
      title: "No pending onboarding items",
      description: "All invitations are accepted or cleared.",
      href: "/admin/invitations",
      tone: "success"
    });
  }

  return {
    id: "invitations",
    title: "Onboarding & invitations",
    description: "Pending invitation review for administrators.",
    items
  };
}

function buildFacilitySection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  const facilityModulePlanned = {
    id: "facility-module",
    title: "Facility hierarchy module planned",
    description: "Property, building, floor, and room management arrives with BUILD-003 through BUILD-006.",
    href: "/cleaning/issues",
    tone: "info" as const
  };

  if (!snapshot.connections.facilityIssues || !snapshot.facilityIssues) {
    return {
      id: "facility",
      title: "Cleaning & facility issues",
      description: "Issue reporting workflows available today via Cleaning Management.",
      items: [facilityModulePlanned],
      emptyTitle: "Issue feed not connected",
      emptyDescription: "Facility issue data is unavailable right now. Cleaning issues may still be accessible from the module."
    };
  }

  const stats = snapshot.facilityIssues;
  const items: ActionCenterItem[] = [facilityModulePlanned];

  if (stats.open > 0) {
    items.push({
      id: "open-issues",
      title: "Open facility issues",
      description: "Review reported cleaning or facility issues.",
      href: "/cleaning/issues",
      tone: toneFromCount(stats.open, 1, 5),
      metricLabel: "Open",
      metricValue: String(stats.open)
    });
  }

  if (stats.critical > 0) {
    items.push({
      id: "critical-issues",
      title: "Critical facility issues",
      description: "High-severity issues need supervisor attention.",
      href: "/cleaning/issues",
      tone: "danger",
      metricLabel: "Critical",
      metricValue: String(stats.critical)
    });
  }

  return {
    id: "facility",
    title: "Cleaning & facility issues",
    description: "Issue reporting workflows available today via Cleaning Management.",
    items
  };
}

function buildDriverSection(): ActionCenterSection {
  return {
    id: "driver",
    title: "Fleet & vehicles",
    description: "Driver modules available in MaintainPro.",
    items: [
      {
        id: "vehicles",
        title: "My vehicles",
        description: "Open assigned vehicle records and documents.",
        href: "/vehicles",
        tone: "info"
      },
      {
        id: "fleet",
        title: "Fleet overview",
        description: "Review fleet tracking and operational views.",
        href: "/fleet",
        tone: "neutral"
      }
    ]
  };
}

function buildReportsSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  return {
    id: "reports",
    title: snapshot.variant === "viewer" ? "Reports & visibility" : "Reports & oversight",
    description: snapshot.variant === "viewer" ? "Read-only operational visibility." : "Management reporting shortcuts.",
    items: [
      {
        id: "reports-hub",
        title: "Reports hub",
        description: "Open cross-module analytics and operational reports.",
        href: "/reports",
        tone: "info"
      },
      {
        id: "compliance",
        title: "Compliance",
        description: "Review compliance records and safety workflows.",
        href: "/compliance",
        tone: "neutral"
      }
    ]
  };
}

function buildMinimalSection(): ActionCenterSection {
  return {
    id: "minimal",
    title: "Available modules",
    description: "Your role has limited specialized signals. Use navigation or the dashboard for module access.",
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        description: "Return to the main dashboard overview.",
        href: "/dashboard",
        tone: "neutral"
      }
    ]
  };
}

export type MorningBriefingLine = {
  id: string;
  label: string;
  value: string;
  tone?: ActionCenterTone;
};

export function buildMorningBriefingLines(snapshot: ActionCenterSnapshot): MorningBriefingLine[] {
  const lines: MorningBriefingLine[] = [];

  if (snapshot.workOrders) {
    const stats = snapshot.workOrders;
    lines.push({
      id: "wo-open",
      label: "Open work orders",
      value: String(stats.open + stats.inProgress),
      tone: stats.open + stats.inProgress > 0 ? "info" : "success"
    });

    if (stats.overdue > 0) {
      lines.push({
        id: "wo-overdue",
        label: "Overdue",
        value: String(stats.overdue),
        tone: "danger"
      });
    }
  }

  if (snapshot.inventory && snapshot.inventory.lowStockCount > 0) {
    lines.push({
      id: "inv-low-stock",
      label: "Low-stock parts",
      value: String(snapshot.inventory.lowStockCount),
      tone: "warning"
    });
  }

  if (snapshot.systemHealth) {
    lines.push({
      id: "sys-health",
      label: "System health",
      value: snapshot.systemHealth.status === "operational" ? "Operational" : "Needs attention",
      tone: snapshot.systemHealth.status === "operational" ? "success" : "warning"
    });
  }

  if (
    snapshot.facilityIssues &&
    (snapshot.variant === "cleaner" || snapshot.roleName === "FACILITY_MANAGER" || snapshot.roleName === "BUILDING_SUPERVISOR")
  ) {
    lines.push({
      id: "facility-open",
      label: "Open facility issues",
      value: String(snapshot.facilityIssues.open),
      tone: snapshot.facilityIssues.open > 0 ? "warning" : "success"
    });
  }

  if (lines.length === 0) {
    lines.push({
      id: "no-signals",
      label: "Operational signals",
      value: "No attention items returned",
      tone: "neutral"
    });
  }

  return lines;
}

export function morningBriefingSupported(variant: ActionCenterVariant): boolean {
  return variant === "admin" || variant === "management" || variant === "inventory";
}
