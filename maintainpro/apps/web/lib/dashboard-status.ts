import { humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";

export type StatusTone = "neutral" | "brand" | "sky" | "amber" | "red" | "emerald" | "violet" | "fuchsia";

const WORK_ORDER_TONES: Record<string, StatusTone> = {
  OPEN: "sky",
  PLANNED: "sky",
  ASSIGNED: "violet",
  IN_PROGRESS: "sky",
  ON_HOLD: "amber",
  TECHNICIAN_COMPLETED: "fuchsia",
  REWORK_REQUIRED: "red",
  VERIFIED: "emerald",
  CLOSED: "emerald",
  COMPLETED: "emerald",
  CANCELLED: "neutral",
  OVERDUE: "red"
};

/** Pill labels for the work-order list. Other screens keep the longer lifecycle wording. */
const BADGE_LABELS: Record<string, string> = {
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  TECHNICIAN_COMPLETED: "Awaiting verification"
};

const OTHER_LABELS: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned",
  CONVERTED: "Converted",
  PENDING: "Pending"
};

const OTHER_TONES: Record<string, StatusTone> = {
  NEW: "neutral",
  UNDER_REVIEW: "sky",
  APPROVED: "emerald",
  REJECTED: "red",
  RETURNED: "amber",
  CONVERTED: "brand",
  PENDING: "amber",
  CANCELLED: "neutral"
};

export function statusBadgePresentation(status: string): { label: string; tone: StatusTone } {
  const key = status.trim().toUpperCase();
  if (key in WORK_ORDER_TONES) {
    return { label: BADGE_LABELS[key] ?? humanWorkOrderStatusLabel(key), tone: WORK_ORDER_TONES[key] };
  }
  return {
    label: OTHER_LABELS[key] ?? humanWorkOrderStatusLabel(key),
    tone: OTHER_TONES[key] ?? "neutral"
  };
}

/** High and critical are red, medium amber, low grey. Unknown priorities are hidden by the caller. */
export function priorityBadgePresentation(priority: string): { label: string; tone: StatusTone } | null {
  const key = priority.trim().toUpperCase();
  if (key === "CRITICAL") return { label: "Critical", tone: "red" };
  if (key === "HIGH") return { label: "High", tone: "red" };
  if (key === "MEDIUM") return { label: "Medium", tone: "amber" };
  if (key === "LOW") return { label: "Low", tone: "neutral" };
  return null;
}

export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  brand: "bg-brand-50 text-brand-800 dark:bg-brand-900 dark:text-brand-100",
  sky: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  red: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
  emerald: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  violet: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  fuchsia: "bg-fuchsia-50 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200"
};
