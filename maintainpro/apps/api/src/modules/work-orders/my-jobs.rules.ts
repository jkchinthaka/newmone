import { REPORTING_TIMEZONE } from "../reports/report-currency.util";

export const MY_JOB_VIEWS = ["active", "overdue", "due-today", "in-progress", "completed"] as const;
export type MyJobView = (typeof MY_JOB_VIEWS)[number];

export const MY_JOB_TERMINAL_STATUSES = ["CLOSED", "CANCELLED", "COMPLETED"] as const;

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

export type MyJobMatchInput = {
  status: string;
  priority?: string | null;
  dueDate?: Date | string | null;
  woNumber?: string;
  title?: string;
  assetName?: string | null;
  assetTag?: string | null;
};

export function isMyJobView(value: string | undefined): value is MyJobView {
  return (MY_JOB_VIEWS as readonly string[]).includes(value ?? "");
}

export function businessDayWindow(now = new Date(), timeZone = REPORTING_TIMEZONE) {
  const dateOnly = new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
  return {
    dateOnly,
    timeZone,
    start: new Date(`${dateOnly}T00:00:00.000+05:30`),
    end: new Date(`${dateOnly}T23:59:59.999+05:30`)
  };
}

export function isTerminalMyJobStatus(status: string) {
  return (MY_JOB_TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isMyJobOverdue(job: MyJobMatchInput, now = new Date()) {
  if (isTerminalMyJobStatus(job.status)) return false;
  if (job.status === "OVERDUE") return true;
  if (!job.dueDate) return false;
  return new Date(job.dueDate).getTime() < businessDayWindow(now).start.getTime();
}

export function matchesMyJobView(job: MyJobMatchInput, view: MyJobView, now = new Date()) {
  if (view === "active") return !isTerminalMyJobStatus(job.status);
  if (view === "completed") return job.status === "COMPLETED" || job.status === "CLOSED";
  if (view === "in-progress") return job.status === "IN_PROGRESS";
  if (view === "overdue") return isMyJobOverdue(job, now);
  const due = job.dueDate ? new Date(job.dueDate).getTime() : null;
  if (due == null || Number.isNaN(due)) return false;
  const window = businessDayWindow(now);
  return due >= window.start.getTime() && due <= window.end.getTime();
}

export function matchesMyJobFilters(
  job: MyJobMatchInput,
  filters: { search?: string; status?: string; priority?: string; due?: string },
  now = new Date()
) {
  if (filters.status && job.status !== filters.status) return false;
  if (filters.priority && (job.priority ?? "") !== filters.priority) return false;
  if (filters.due === "none" && job.dueDate) return false;
  if (filters.due === "overdue" && !isMyJobOverdue(job, now)) return false;
  if (filters.due === "today" && !matchesMyJobView(job, "due-today", now)) return false;
  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;
  const haystack = [job.woNumber, job.title, job.assetName, job.assetTag].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(search);
}

export function compareMyJobs(left: MyJobMatchInput & { id: string }, right: MyJobMatchInput & { id: string }, now = new Date()) {
  const overdueDelta = Number(isMyJobOverdue(right, now)) - Number(isMyJobOverdue(left, now));
  if (overdueDelta !== 0) return overdueDelta;
  const priorityDelta = (PRIORITY_RANK[left.priority ?? ""] ?? 9) - (PRIORITY_RANK[right.priority ?? ""] ?? 9);
  if (priorityDelta !== 0) return priorityDelta;
  const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.id.localeCompare(right.id);
}

export function assignedToActorScope(userId: string) {
  return {
    OR: [
      { technicianId: userId },
      {
        assignees: {
          some: {
            assignmentStatus: { not: "REMOVED" },
            employee: { linkedUserId: userId }
          }
        }
      }
    ]
  };
}
