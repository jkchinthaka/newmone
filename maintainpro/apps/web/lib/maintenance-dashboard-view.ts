import { myJobFilterHref } from "./my-job-filters";

/** Shared destinations for the maintenance dashboard. Counts stay on the API. */

/**
 * Queue key behind each dashboard filter. Inventory keepers match
 * `roleCanAccessQueue`: they can open waiting-parts, unassigned, open-load,
 * and in-progress, and they cannot open overdue or technician-completed.
 */
const INVENTORY_DASHBOARD_QUEUES = new Set(["waiting-parts", "unassigned", "open-load", "in-progress"]);

export function isTechnicianMaintenanceDashboard(role: string | null | undefined): boolean {
  const normalized = String(role ?? "").toUpperCase().trim();
  return normalized === "TECHNICIAN" || normalized === "MECHANIC";
}

export function workOrderFilterHref(filter: string): string {
  return `/work-orders?filter=${filter}`;
}

export const MANAGER_ACTION_CARDS = [
  { id: "overdue", label: "Overdue", href: workOrderFilterHref("overdue"), countKey: "overdueJobs", queue: "overdue" },
  {
    id: "unassigned",
    label: "Unassigned",
    href: workOrderFilterHref("unassigned"),
    countKey: "unassignedJobs",
    queue: "unassigned"
  },
  {
    id: "verification-required",
    label: "Verification Required",
    href: workOrderFilterHref("verification-required"),
    countKey: "verificationRequired",
    queue: "technician-completed"
  },
  {
    id: "waiting-parts",
    label: "Waiting for Parts",
    href: workOrderFilterHref("waiting-parts"),
    countKey: "waitingParts",
    queue: "waiting-parts"
  }
] as const;

export const WORKLOAD_CARDS = [
  { id: "open", label: "Open", href: workOrderFilterHref("open"), countKey: "openJobs", queue: "open-load" },
  { id: "unassigned", label: "Unassigned", href: workOrderFilterHref("unassigned"), countKey: "unassignedJobs", queue: "unassigned" },
  {
    id: "in-progress",
    label: "In Progress",
    href: workOrderFilterHref("in-progress"),
    countKey: "inProgressJobs",
    queue: "in-progress"
  },
  { id: "on-hold", label: "On Hold", href: workOrderFilterHref("on-hold"), countKey: "onHoldJobs", queue: "in-progress" },
  {
    id: "verification-required",
    label: "Verification Required",
    href: workOrderFilterHref("verification-required"),
    countKey: "verificationRequired",
    queue: "technician-completed"
  }
] as const;

export const TECHNICIAN_ACTION_CARDS = [
  { id: "my-jobs", label: "My Jobs", href: myJobFilterHref("active"), countKey: "active" },
  { id: "due-today", label: "Due Today", href: myJobFilterHref("due-today"), countKey: "dueToday" },
  { id: "overdue", label: "Overdue", href: myJobFilterHref("overdue"), countKey: "overdue" },
  { id: "waiting-parts", label: "Waiting Parts", href: myJobFilterHref("waiting-parts"), countKey: "waitingParts" }
] as const;

export function dashboardCardsForRole<T extends { queue: string }>(role: string | null | undefined, cards: readonly T[]): T[] {
  const normalized = String(role ?? "").toUpperCase().trim();
  if (normalized !== "INVENTORY_KEEPER") return [...cards];
  return cards.filter((card) => INVENTORY_DASHBOARD_QUEUES.has(card.queue));
}

export function actionCardTone(count: number): "default" | "warn" | "critical" {
  if (count <= 0) return "default";
  return "warn";
}
