import type { StatusTone } from "@/lib/dashboard-status";
import { primaryWorkOrderAction } from "@/lib/work-order-next-action";

const DAY_MS = 24 * 60 * 60 * 1000;
const APPROVE_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"]);

export type WorkOrderKpi = {
  id: "open" | "unassigned" | "overdue";
  label: string;
  value: number;
  delta?: string;
  tone: StatusTone;
  queue: "open-requests" | "unassigned" | "overdue";
};

function queueCount(queues: Array<{ key: string; count?: number | null }> | null | undefined, key: string): number | null {
  const row = queues?.find((item) => item.key === key);
  return typeof row?.count === "number" && Number.isFinite(row.count) ? row.count : null;
}

/**
 * KPI row for the work-order queues view.
 * Closed this week is omitted: the queue summary has a completed count, not a this-week count.
 * Oldest-unassigned age is included only when the caller has the full unassigned set.
 */
export function deriveWorkOrderKpis(input: {
  queues?: Array<{ key: string; count?: number | null }> | null;
  openUnassigned?: number | null;
  oldestUnassignedDays?: number | null;
}): WorkOrderKpi[] {
  if (!input.queues) return [];
  const cards: WorkOrderKpi[] = [];
  const open = queueCount(input.queues, "open-requests");
  if (open != null) {
    cards.push({
      id: "open",
      label: "Open",
      value: open,
      // Two summary fields can disagree (different scopes). Never show a sub-count above the card value.
      delta:
        typeof input.openUnassigned === "number" && input.openUnassigned >= 0 && input.openUnassigned <= open
          ? `${input.openUnassigned} need assignment`
          : undefined,
      tone: "sky",
      queue: "open-requests"
    });
  }
  const unassigned = queueCount(input.queues, "unassigned");
  if (unassigned != null) {
    const days = input.oldestUnassignedDays;
    cards.push({
      id: "unassigned",
      label: "Unassigned",
      value: unassigned,
      delta: typeof days === "number" ? `oldest ${days} ${days === 1 ? "day" : "days"}` : undefined,
      tone: "neutral",
      queue: "unassigned"
    });
  }
  const overdue = queueCount(input.queues, "overdue");
  if (overdue != null) {
    cards.push({
      id: "overdue",
      label: "Overdue",
      value: overdue,
      delta: "past due date",
      tone: overdue > 0 ? "red" : "neutral",
      queue: "overdue"
    });
  }
  return cards;
}

/** Age of the oldest row. Returns null unless every row has a created time (the set is complete). */
export function oldestAgeDays(rows: Array<{ createdAt?: string | null }>, now = new Date()): number | null {
  if (rows.length === 0) return null;
  const times = rows.map((row) => (row.createdAt ? new Date(row.createdAt).getTime() : Number.NaN));
  if (times.some((time) => !Number.isFinite(time))) return null;
  const oldest = Math.min(...times);
  return Math.max(0, Math.floor((now.getTime() - oldest) / DAY_MS));
}

export function holdReasonSuffix(status: string, holdNotes?: string | null, holdReasonCode?: string | null): string | null {
  if (status !== "ON_HOLD") return null;
  const notes = holdNotes?.trim();
  if (notes) return notes;
  const code = holdReasonCode?.trim();
  if (!code) return null;
  return code.replaceAll("_", " ").toLowerCase();
}

export type QueueNextControl =
  | { kind: "action"; actionId: string; label: string }
  | { kind: "view"; label: "View" };

/** Green action only when the existing permission check already allows it. Otherwise View. */
export function queueNextControl(input: {
  status: string;
  role?: string | null;
  approvalStatus?: string | null;
}): QueueNextControl {
  const next = primaryWorkOrderAction(input);
  if (next && !next.disabledReason) {
    return { kind: "action", actionId: next.id, label: next.label };
  }
  if (input.approvalStatus === "PENDING" && input.status === "OPEN" && APPROVE_ROLES.has(input.role ?? "")) {
    return { kind: "action", actionId: "approve-assign", label: "Approve" };
  }
  return { kind: "view", label: "View" };
}

export function approvalAmountTone(amount: number | null | undefined): "red" | "amber" | "neutral" | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  if (amount >= 100_000) return "red";
  if (amount >= 25_000) return "amber";
  return "neutral";
}

export function sortOldestFirst<T extends { requestedAt?: string | null }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const a = left.requestedAt ? Date.parse(left.requestedAt) : Number.POSITIVE_INFINITY;
    const b = right.requestedAt ? Date.parse(right.requestedAt) : Number.POSITIVE_INFINITY;
    const aTime = Number.isFinite(a) ? a : Number.POSITIVE_INFINITY;
    const bTime = Number.isFinite(b) ? b : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

export function fleetServiceBadge(
  nextServiceDate?: string | null,
  now = new Date()
): { label: string; tone: StatusTone } | null {
  if (!nextServiceDate) return null;
  const due = new Date(nextServiceDate);
  if (Number.isNaN(due.getTime())) return null;
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return { label: `Overdue ${Math.abs(days)} d`, tone: "red" };
  if (days <= 7) return { label: days === 1 ? "In 1 day" : `In ${days} days`, tone: "amber" };
  return { label: days === 1 ? "In 1 day" : `In ${days} days`, tone: "emerald" };
}

/** True when at least one row has a value for the column, so an all-empty column can be hidden. */
export function columnHasData<T>(rows: readonly T[], read: (row: T) => unknown): boolean {
  return rows.some((row) => {
    const value = read(row);
    return value != null && value !== "";
  });
}

export function fleetDocumentBadge(
  docs: Array<{ label: string; at?: string | null }>,
  now = new Date()
): { label: string; tone: StatusTone } | null {
  const parsed = docs.flatMap((doc) => {
    if (!doc.at) return [];
    const time = new Date(doc.at).getTime();
    if (Number.isNaN(time)) return [];
    return [{ label: doc.label, days: Math.ceil((time - now.getTime()) / DAY_MS) }];
  });
  if (parsed.length === 0) return null;
  const soonest = [...parsed].sort((left, right) => left.days - right.days)[0];
  if (soonest.days > 30) return { label: "Valid", tone: "emerald" };
  return { label: `${soonest.label} ${Math.max(0, soonest.days)} d`, tone: "amber" };
}

export function fleetGateBadge(gateBlocked?: boolean | null): { label: string; tone: StatusTone } | null {
  if (typeof gateBlocked !== "boolean") return null;
  return gateBlocked ? { label: "Blocked", tone: "red" } : { label: "Ready", tone: "emerald" };
}

export function fleetEnumLabel(value?: string | null): string | null {
  const text = value?.trim();
  if (!text) return null;
  return text
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function fleetUsageLabel(mileage?: number | string | null): string | null {
  if (mileage == null || mileage === "") return null;
  const value = typeof mileage === "number" ? mileage : Number(mileage);
  if (!Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 }).format(value)} km`;
}

export function visibleTopUsedParts<T extends { partName?: string | null; quantity?: number | null }>(
  rows: T[] | null | undefined
): T[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const items = rows.filter((row) => Boolean(row.partName?.trim()) && typeof row.quantity === "number" && Number.isFinite(row.quantity));
  return items.length > 0 ? items : null;
}

/** No existing endpoint lists part requests across work orders, so the issue panel stays hidden. */
export const PART_REQUESTS_TO_ISSUE_AVAILABLE = false;
