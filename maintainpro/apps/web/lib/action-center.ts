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
  /** HIGH/CRITICAL priority, non-terminal, tenant-wide. Left 0 for technicians (see note in action-center-api.ts). */
  highPriority: number;
  /** Open jobs assigned to the current actor (technician variant only). */
  assigned?: number;
  /** Vendor repair invoices submitted/under review — finance variant only. */
  financeVendorPending?: number;
};

export type ActionCenterInventoryStats = {
  /** null when this role cannot read stock, or the stock request failed. */
  lowStockCount: number | null;
  /** null when this role cannot read stock, or the parts request failed. */
  criticalCount: number | null;
  /** null when the purchase-orders call failed but parts/low-stock data was still usable. */
  pendingPurchaseOrders: number | null;
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

/**
 * Why a snapshot section failed to load, distinguished without exposing raw
 * error detail: a rendered "not connected" message can then tell a real
 * permission gap (which retrying will never fix) apart from a transient outage.
 */
export type ActionCenterErrorKind = "unauthorized" | "unavailable" | "network" | "server" | "partial" | "unknown";

export type ActionCenterSnapshot = {
  variant: ActionCenterVariant;
  roleName: string | null;
  permissions?: readonly string[];
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
  /** Set only for a section that failed to load; a section that never fetches has no entry. */
  errors?: Partial<{
    workOrders: ActionCenterErrorKind;
    inventory: ActionCenterErrorKind;
    systemHealth: ActionCenterErrorKind;
    invitations: ActionCenterErrorKind;
    facilityIssues: ActionCenterErrorKind;
  }>;
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

const INVENTORY_STOCK_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "MECHANIC",
  "INVENTORY_KEEPER",
  "MANAGER",
  "OPERATIONS_MANAGER"
]);

const INVENTORY_PURCHASE_ORDER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "INVENTORY_KEEPER",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "PROCUREMENT_OFFICER",
  "FINANCE"
]);

export type ActionCenterInventoryAccess = { stock: boolean; purchaseOrders: boolean };

/** Mirrors the role AND permission guards on the inventory endpoints. */
export function resolveActionCenterInventoryAccess(
  roleName: string | null | undefined,
  permissions: readonly string[] | undefined
): ActionCenterInventoryAccess {
  const role = extractRoleName(roleName);
  if (!role) return { stock: false, purchaseOrders: false };
  if (role === "SUPER_ADMIN") return { stock: true, purchaseOrders: true };

  const permissionSet = new Set(permissions ?? []);
  return {
    stock: INVENTORY_STOCK_ROLES.has(role) && permissionSet.has("inventory.manage"),
    purchaseOrders:
      INVENTORY_PURCHASE_ORDER_ROLES.has(role) && permissionSet.has("purchase_orders.view")
  };
}

export function actionCenterShowsInventory(
  variant: ActionCenterVariant,
  roleName?: string | null,
  permissions?: readonly string[]
): boolean {
  if (!(variant === "admin" || variant === "inventory" || variant === "management" || variant === "procurement")) {
    return false;
  }
  const access = resolveActionCenterInventoryAccess(roleName, permissions);
  return access.stock || access.purchaseOrders;
}

export function actionCenterShowsFinanceSignals(variant: ActionCenterVariant): boolean {
  return variant === "finance";
}

const REPORTING_KPI_ROLES = new Set([
  "SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTENANCE_MANAGER", "OPERATIONS_MANAGER",
  "ASSET_MANAGER", "FLEET_MANAGER", "SUPERVISOR", "MAINTENANCE_SUPERVISOR", "VIEWER",
  "AUDITOR", "FINANCE", "FINANCE_APPROVER", "COMPLIANCE_MANAGER"
]);

/** Mirrors ReportingKpisController.overview's role and reports.view guards. */
export function actionCenterShowsKpis(
  roleName: string | null | undefined,
  permissions: readonly string[] | undefined
): boolean {
  const role = extractRoleName(roleName);
  if (!role || !REPORTING_KPI_ROLES.has(role)) return false;
  return role === "SUPER_ADMIN" || Boolean(permissions?.includes("reports.view"));
}

/**
 * Roles whose backend access covers the canonical /facilities/dashboard summary
 * (FacilitiesController.FACILITY_READ_ROLES) — the preferred source for general
 * management-style roles.
 */
const FACILITY_DASHBOARD_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "SUPERVISOR",
  "VIEWER"
]);

/**
 * Roles whose backend access covers only the legacy /cleaning/issues endpoint
 * (CleaningController's own @Roles list) and not /facilities/dashboard.
 */
const FACILITY_LEGACY_CLEANING_ROLES = new Set(["CLEANER", "ASSET_MANAGER"]);

/**
 * Resolves which backend endpoint (if any) this role is actually authorized to
 * call for facility/cleaning issue counts. Replaces the old variant==="management"
 * check, which showed the section (and triggered a guaranteed 403) for roles like
 * FLEET_MANAGER, COMPLIANCE_MANAGER, OPERATIONS_MANAGER and SECURITY_OFFICER that
 * have no backend access to either endpoint.
 */
export function resolveFacilityIssuesSource(
  roleName: string | null | undefined
): "dashboard" | "cleaning" | "none" {
  const role = extractRoleName(roleName);
  if (!role) return "none";
  if (FACILITY_DASHBOARD_ROLES.has(role)) return "dashboard";
  if (FACILITY_LEGACY_CLEANING_ROLES.has(role)) return "cleaning";
  return "none";
}

export function actionCenterShowsFacilityIssues(variant: ActionCenterVariant, roleName: string | null): boolean {
  void variant; // gating is by real backend-authorized role now, not by variant bucket
  return resolveFacilityIssuesSource(roleName) !== "none";
}

export function actionCenterShowsDriverLinks(variant: ActionCenterVariant): boolean {
  return variant === "driver";
}

export function actionCenterShowsFg(permissions: readonly string[] | undefined, roleName: string | null): boolean {
  if (extractRoleName(roleName) === "SUPER_ADMIN") {
    return true;
  }
  return Boolean(permissions?.includes("fg.access"));
}

export function actionCenterIsReadOnly(variant: ActionCenterVariant): boolean {
  return variant === "viewer" || variant === "minimal" || variant === "finance";
}

export function getActionCenterTitle(variant: ActionCenterVariant): string {
  switch (variant) {
    case "admin":
      return "Home";
    case "management":
      return "Home";
    case "technician":
      return "Home";
    case "inventory":
      return "Home";
    case "cleaner":
      return "Home";
    case "driver":
      return "Home";
    case "viewer":
      return "Home";
    case "finance":
      return "Home";
    case "procurement":
      return "Home";
    default:
      return "Home";
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
    case "finance":
      return "Vendor invoice attention and financial reporting shortcuts. This view is read-only.";
    case "procurement":
      return "Procurement, vendor, and inventory attention from live records.";
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

  if (actionCenterShowsInventory(snapshot.variant, snapshot.roleName, snapshot.permissions)) {
    sections.push(buildInventorySection(snapshot));
  }

  if (actionCenterShowsInvitations(snapshot.roleName)) {
    sections.push(buildInvitationsSection(snapshot));
  }

  if (actionCenterShowsFacilityIssues(snapshot.variant, snapshot.roleName)) {
    sections.push(buildFacilitySection(snapshot));
  }

  if (actionCenterShowsFinanceSignals(snapshot.variant)) {
    sections.push(buildFinanceSection(snapshot));
  }

  if (actionCenterShowsFg(snapshot.permissions, snapshot.roleName)) {
    sections.push(buildFgSection());
  }

  if (actionCenterShowsDriverLinks(snapshot.variant)) {
    sections.push(buildDriverSection());
  }

  if (
    snapshot.variant === "admin" ||
    snapshot.variant === "viewer" ||
    snapshot.variant === "minimal" ||
    snapshot.variant === "management" ||
    snapshot.variant === "finance"
  ) {
    sections.push(buildReportsSection(snapshot));
  }

  if (snapshot.variant === "minimal") {
    sections.push(buildMinimalSection());
  }

  return sections.filter((section) => section.items.length > 0 || section.emptyTitle);
}

function matchesActionCenterQuery(item: ActionCenterItem, query: string): boolean {
  return [item.title, item.description, item.statusLabel, item.metricLabel]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

/**
 * Filters Action Center sections down to items matching a free-text search query.
 * A section whose title itself matches keeps all of its items; otherwise only
 * items whose title/description/status/metric match survive. Sections left with
 * no items (including "not connected" placeholder sections) are dropped rather
 * than shown empty.
 */
export function filterActionCenterSections(
  sections: ActionCenterSection[],
  query: string
): ActionCenterSection[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return sections;
  }

  return sections
    .map((section) => {
      const titleMatches = section.title.toLowerCase().includes(trimmed);
      const items = titleMatches
        ? section.items
        : section.items.filter((item) => matchesActionCenterQuery(item, trimmed));
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);
}

/**
 * Turns a snapshot error kind into empty-state copy that tells a real
 * permission gap (retrying will never fix it) apart from a transient outage
 * (retrying might). Falls back to the original always-transient wording when
 * no error was recorded (e.g. the section was simply never fetched).
 */
function describeUnavailable(
  errorKind: ActionCenterErrorKind | undefined,
  fallbackTitle: string,
  fallbackDescription: string
): { title: string; description: string } {
  if (errorKind === "unauthorized") {
    return {
      title: "Not available to your role",
      description: "Your account doesn't have access to this data. Contact an administrator if you believe this is wrong."
    };
  }
  if (errorKind === "server" || errorKind === "network") {
    return {
      title: "Temporarily unavailable",
      description: "This data couldn't be loaded right now. It will retry automatically — try refreshing if it persists."
    };
  }
  return { title: fallbackTitle, description: fallbackDescription };
}

function buildSystemHealthSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  if (!snapshot.connections.systemHealth || !snapshot.systemHealth) {
    const state = describeUnavailable(
      snapshot.errors?.systemHealth,
      "Not connected yet",
      "System health data is unavailable right now. Open System Health to retry."
    );
    return {
      id: "system-health",
      title: "System health",
      description: "Platform readiness checks for administrators.",
      items: [],
      emptyTitle: state.title,
      emptyDescription: state.description
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
    const state = describeUnavailable(
      snapshot.errors?.workOrders,
      "Not connected yet",
      "Work order data is unavailable right now."
    );
    return {
      id: "work-orders",
      title: snapshot.variant === "technician" ? "My work orders" : "Work order risks",
      description: "Live maintenance queue signals.",
      items: [],
      emptyTitle: state.title,
      emptyDescription: state.description
    };
  }

  const stats = snapshot.workOrders;
  const items: ActionCenterItem[] = [];

  if (snapshot.variant === "technician" && stats.assigned != null) {
    items.push({
      id: "assigned-work",
      title: "Assigned work orders",
      description: "Open jobs assigned to you.",
      href: "/work-orders?queue=my-tasks",
      tone: stats.assigned > 0 ? "info" : "success",
      metricLabel: "Assigned",
      metricValue: String(stats.assigned)
    });
  }

  if (snapshot.variant === "technician") {
    items.push({
      id: "waiting-evidence",
      title: "Evidence needed",
      description: "Jobs waiting for technician evidence uploads.",
      href: "/work-orders?queue=waiting-evidence",
      tone: "warning"
    });
    items.push({
      id: "waiting-parts",
      title: "Waiting parts",
      description: "Jobs blocked until parts are issued.",
      href: "/work-orders?queue=waiting-parts",
      tone: "warning"
    });
    items.push({
      id: "rework-required",
      title: "Rework required",
      description: "Jobs sent back for correction.",
      href: "/work-orders?queue=rework-required",
      tone: "danger"
    });
  }

  if (snapshot.variant === "management" || snapshot.roleName === "SUPERVISOR" || snapshot.roleName === "MAINTENANCE_SUPERVISOR") {
    items.push({
      id: "supervisor-verification",
      title: "Pending verification",
      description: "Technician completed jobs awaiting supervisor sign-off.",
      href: "/work-orders?queue=supervisor-verification",
      tone: "warning"
    });
    items.push({
      id: "team-triage",
      title: "Triage queue",
      description: "Work orders needing classification.",
      href: "/work-orders?queue=triage",
      tone: "info"
    });
  }

  if (snapshot.roleName === "SECURITY_OFFICER") {
    items.push({
      id: "gate-dashboard",
      title: "Gate dashboard",
      description: "Vehicle gate-out checks and restrictions.",
      href: "/fleet/gate",
      tone: "info"
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
    const state = describeUnavailable(
      snapshot.errors?.inventory,
      "Not connected yet",
      "Inventory data is unavailable right now."
    );
    return {
      id: "inventory",
      title: "Inventory & procurement",
      description: "Stock and purchase order attention.",
      items: [],
      emptyTitle: state.title,
      emptyDescription: state.description
    };
  }

  const stats = snapshot.inventory;
  const items: ActionCenterItem[] = [];

  if (stats.lowStockCount !== null && stats.lowStockCount > 0) {
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

  if (stats.criticalCount !== null && stats.criticalCount > 0) {
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

  if (stats.pendingPurchaseOrders !== null && stats.pendingPurchaseOrders > 0) {
    items.push({
      id: "pending-pos",
      title: "Pending purchase orders",
      description: "Open procurement requests awaiting progress.",
      href: "/procurement",
      tone: "warning",
      metricLabel: "Pending POs",
      metricValue: String(stats.pendingPurchaseOrders)
    });
  } else if (stats.pendingPurchaseOrders === null) {
    items.push({
      id: "pending-pos-unavailable",
      title: "Purchase order data unavailable",
      description: "Low-stock and critical counts above are still live; purchase order status could not be loaded.",
      href: "/procurement",
      tone: "neutral",
      statusLabel: "Degraded"
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
    const state = describeUnavailable(
      snapshot.errors?.invitations,
      "Not connected yet",
      "Invitation review data is unavailable right now."
    );
    return {
      id: "invitations",
      title: "Onboarding & invitations",
      description: "Pending invitation review for administrators.",
      items: [],
      emptyTitle: state.title,
      emptyDescription: state.description
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
  const facilityHierarchyLink: ActionCenterItem = {
    id: "facility-hierarchy",
    title: "Open facility hierarchy",
    description: "Browse properties, buildings, floors, and rooms for your tenant.",
    href: "/facilities",
    tone: "info"
  };
  const facilityReportsLink: ActionCenterItem = {
    id: "facility-reports",
    title: "Facility reports",
    description: "Hierarchy counts, issue breakdowns, and work order linkage summary.",
    href: "/facilities/reports",
    tone: "info"
  };
  const facilityAgingLink: ActionCenterItem = {
    id: "facility-aging",
    title: "SLA / aging report",
    description: "Issue aging buckets, overdue SLA preview, and linked work order aging.",
    href: "/facilities/reports/aging",
    tone: "info"
  };

  if (!snapshot.connections.facilityIssues || !snapshot.facilityIssues) {
    // Hierarchy/reports/aging links always work even when the live issue-count
    // feed is down, so `items` is never empty here — which means ActionSection's
    // empty-state (driven by emptyTitle) can never render. Show the degraded
    // state as a real, visible item instead of a message nobody sees.
    const errorKind = snapshot.errors?.facilityIssues;
    const degradedWarning: ActionCenterItem = {
      id: "facility-issues-unavailable",
      title: errorKind === "unauthorized" ? "Issue counts not available to your role" : "Issue feed unavailable",
      description:
        errorKind === "unauthorized"
          ? "Your role doesn't have access to live open/critical issue counts. Hierarchy and reports links below still work."
          : "Live open/critical issue counts could not be loaded right now. Hierarchy and reports links below still work.",
      href: "/facilities",
      tone: "warning",
      statusLabel: "Degraded"
    };
    return {
      id: "facility",
      title: "Cleaning & facility issues",
      description: "Issue reporting workflows available today via Cleaning Management.",
      items: [facilityHierarchyLink, facilityReportsLink, facilityAgingLink, degradedWarning]
    };
  }

  const stats = snapshot.facilityIssues;
  const items: ActionCenterItem[] = [facilityHierarchyLink, facilityReportsLink, facilityAgingLink];

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

function buildFinanceSection(snapshot: ActionCenterSnapshot): ActionCenterSection {
  const stats = snapshot.workOrders;

  if (!snapshot.connections.workOrders || !stats) {
    return {
      id: "finance",
      title: "Vendor & finance attention",
      description: "Vendor repair invoices needing finance review.",
      items: [],
      emptyTitle: "Not connected yet",
      emptyDescription: "Vendor invoice data is unavailable right now."
    };
  }

  const pending = stats.financeVendorPending ?? 0;
  const items: ActionCenterItem[] = [
    {
      id: "finance-vendor-pending",
      title: "Vendor invoices pending",
      description: "Vendor repair invoices submitted or under review.",
      href: "/work-orders?queue=finance-vendor-pending",
      tone: pending > 0 ? "warning" : "success",
      metricLabel: "Pending",
      metricValue: String(pending)
    }
  ];

  return {
    id: "finance",
    title: "Vendor & finance attention",
    description: "Vendor repair invoices needing finance review. This view is read-only.",
    items
  };
}

function buildFgSection(): ActionCenterSection {
  return {
    id: "fg-digital-records",
    title: "FG Digital Records",
    description: "Controlled production records and verification. Counts come from the FG module, not this board.",
    items: [
      {
        id: "fg-dashboard",
        title: "Open FG Digital Records",
        description: "Start or continue today's controlled production records.",
        href: "/fg",
        tone: "info"
      },
      {
        id: "fg-review",
        title: "Supervisor review",
        description: "Open the FG review queue.",
        href: "/fg/review",
        tone: "warning"
      },
      {
        id: "fg-qa",
        title: "QA verification",
        description: "Open the FG QA verification queue.",
        href: "/fg/qa",
        tone: "warning"
      }
    ]
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
  // NOTE: this previously linked to /dashboard, which itself redirects straight
  // back to /action-center (see apps/web/app/(dashboard)/dashboard/page.tsx) —
  // a card whose only effect was to reload the page the user was already on.
  // RoleHomeCards already covers this audience with Report Issue / New Request /
  // My Requests (the REQUESTER profile, the fallback for any unmapped role), so
  // this section now offers genuinely different destinations instead.
  return {
    id: "minimal",
    title: "Available modules",
    description: "Your role has limited specialized signals. Use the links below or the top navigation for module access.",
    items: [
      {
        id: "notifications",
        title: "Notifications",
        description: "Review recent alerts and updates.",
        href: "/notifications",
        tone: "neutral"
      },
      {
        id: "settings",
        title: "Settings",
        description: "Account and workspace settings.",
        href: "/settings",
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

  if (snapshot.inventory && snapshot.inventory.lowStockCount !== null && snapshot.inventory.lowStockCount > 0) {
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
