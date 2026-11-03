import { formatColomboDateTime } from "./colombo-datetime";

/**
 * The job flow every user sees (display only): a technician starts with a live before photo,
 * finishes with an after photo, then a supervisor checks it before it is closed.
 */
export const WORK_ORDER_DRAWER_STEPS = [
  "New",
  "Assigned",
  "Working",
  "Done",
  "Supervisor check",
  "Closed"
] as const;

export type WorkOrderDrawerStep = (typeof WORK_ORDER_DRAWER_STEPS)[number];

export type WorkOrderDrawerStepper =
  | { cancelled: true }
  | { cancelled: false; index: number; steps: readonly WorkOrderDrawerStep[] };

const STEP_INDEX: Record<string, number> = {
  OPEN: 0,
  PLANNED: 0,
  APPROVED: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  ON_HOLD: 2,
  WAITING_PARTS: 2,
  REWORK_REQUIRED: 2,
  OVERDUE: 2,
  TECHNICIAN_COMPLETED: 3,
  VERIFIED: 4,
  COMPLETED: 5,
  CLOSED: 5
};

/** What the person on the job does next, in one short line. */
export const WORK_ORDER_STEP_HELP: Record<WorkOrderDrawerStep, string> = {
  New: "Waiting to be approved and assigned.",
  Assigned: "Technician: press Start and take a before photo with the camera.",
  Working: "Do the work. When finished, take an after photo and complete the job.",
  Done: "Supervisor: check the photos and the work.",
  "Supervisor check": "Checked. An authorised person closes the job.",
  Closed: "Finished."
};

/** Display-only progress. Does not change the stored status. */
export function workOrderDrawerStepper(status: string): WorkOrderDrawerStepper {
  if (status === "CANCELLED") return { cancelled: true };
  const index = STEP_INDEX[status] ?? 0;
  return { cancelled: false, index, steps: WORK_ORDER_DRAWER_STEPS };
}

/**
 * Display title only. Strips a leading request number and a trailing numeric
 * test suffix. The stored title is unchanged.
 */
export function displayWorkOrderTitle(title: string): string {
  const original = title.trim();
  let next = original.replace(/^(?:MR|REQ)-\d{4}-\d+\s*[-–—:]?\s*/i, "");
  next = next.replace(/\s+#?\d{4,}\s*$/, "");
  const cleaned = next.trim();
  return cleaned || original;
}

export function isWorkOrderDrawerReadOnly(status: string): boolean {
  return status === "CLOSED" || status === "CANCELLED";
}

/** Live clock from a segment start. Hours are not capped at 24. */
export function formatDowntimeElapsed(startedAt: string, nowMs: number): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return "00:00:00";
  const total = Math.max(0, Math.floor((nowMs - start) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatDowntimeSpan(startedAt: string, endedAt: string | null | undefined, nowMs: number): string {
  const start = Date.parse(startedAt);
  if (Number.isNaN(start)) return "—";
  const end = endedAt ? Date.parse(endedAt) : nowMs;
  if (Number.isNaN(end)) return "—";
  const total = Math.max(0, Math.floor((end - start) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours <= 0) return `${minutes} m`;
  return `${hours} h ${minutes} m`;
}

/** Display hint from the current status and role. It does not perform the action. */
export function workOrderNextStepHint(status: string, role?: string | null): string {
  if (status === "CLOSED") return "This job is closed. The record stays as history.";
  if (status === "CANCELLED") return "This job is cancelled. The record stays as history.";
  if (status === "IN_PROGRESS" || status === "ON_HOLD") {
    return "Upload the after photo and mark the job complete. The manager will verify and close it.";
  }
  if (status === "ASSIGNED") {
    if (role === "TECHNICIAN" || role === "MECHANIC") {
      return "Start the job when you are on site. The planned window is on Assignment.";
    }
    return "The team is assigned. Work starts when the technician begins the job.";
  }
  if (status === "TECHNICIAN_COMPLETED" || status === "VERIFIED") {
    if (role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPERVISOR") {
      return "Review the photos and close the job when the work is confirmed.";
    }
    return "Waiting for a manager to verify and close the job.";
  }
  if (status === "REWORK_REQUIRED") return "Correct the rejected work, then complete the job again.";
  if (status === "COMPLETED") return "This job is complete. A manager can close it when the record is confirmed.";
  return "Confirm the job details, then assign the team.";
}

const VENDOR_STEP_INDEX: Record<string, number> = {
  VENDOR_REPAIR_REQUESTED: 0,
  QUOTATION_REQUIRED: 0,
  QUOTATION_SUBMITTED: 0,
  EMERGENCY_VENDOR_REPAIR: 0,
  MANAGER_OVERRIDE_REQUIRED: 0,
  QUOTATION_APPROVED: 1,
  VENDOR_WORK_AUTHORIZED: 2,
  SENT_TO_VENDOR: 2,
  VENDOR_IN_PROGRESS: 2,
  VENDOR_COMPLETED: 2,
  SUPERVISOR_VERIFIED: 2,
  INVOICE_SUBMITTED: 3,
  FINANCE_REVIEW: 3,
  FINANCE_APPROVED: 3,
  CLOSED: 4
};

export const VENDOR_REPAIR_STEPS = ["Price quote", "Approval", "Work done", "Invoice", "Completed"] as const;

export function vendorRepairStepper(status?: string | null):
  | { cancelled: true }
  | { cancelled: false; index: number; pendingApproval: boolean } {
  if (!status) return { cancelled: false, index: 0, pendingApproval: false };
  if (status === "CANCELLED") return { cancelled: true };
  const pendingApproval =
    status === "QUOTATION_SUBMITTED" ||
    status === "INVOICE_SUBMITTED" ||
    status === "FINANCE_REVIEW" ||
    status === "MANAGER_OVERRIDE_REQUIRED";
  return { cancelled: false, index: VENDOR_STEP_INDEX[status] ?? 0, pendingApproval };
}

export function formatDrawerDateTime(value?: string | null): string {
  if (!value) return "";
  return formatColomboDateTime(value);
}

export function downtimeCategoryLabel(category: string): string {
  return category
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
