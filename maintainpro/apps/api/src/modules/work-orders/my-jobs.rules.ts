import { EvidenceVerificationStatus, WorkOrderType } from "@prisma/client";

import { evaluateEvidenceRequirements, type EvidenceLineSnapshot } from "../../common/utils/work-order-evidence-governance";
import { REPORTING_TIMEZONE } from "../reports/report-currency.util";

export const MY_JOB_VIEWS = [
  "active",
  "overdue",
  "due-today",
  "waiting-parts",
  "evidence-needed",
  "rework-required",
  "in-progress",
  "completed"
] as const;
export type MyJobView = (typeof MY_JOB_VIEWS)[number];

export const MY_JOB_TERMINAL_STATUSES = ["CLOSED", "CANCELLED", "COMPLETED"] as const;

const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

export type MyJobPartLine = {
  lineStatus?: string | null;
  pendingReturnQuantity?: number | null;
  issuedQuantity?: number | null;
  requestedQuantity?: number | null;
};

export type MyJobMatchInput = {
  status: string;
  priority?: string | null;
  dueDate?: Date | string | null;
  woNumber?: string;
  title?: string;
  assetName?: string | null;
  assetTag?: string | null;
  type?: string | null;
  parts?: MyJobPartLine[];
  hasPartIssue?: boolean;
  evidenceAttachments?: EvidenceLineSnapshot[];
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

export function isMyJobWaitingParts(job: MyJobMatchInput) {
  if (isTerminalMyJobStatus(job.status)) return false;
  if (job.hasPartIssue) return true;
  return (job.parts ?? []).some(
    (line) =>
      line.lineStatus === "REQUESTED" ||
      (line.pendingReturnQuantity ?? 0) > 0 ||
      (line.lineStatus === "APPROVED" && (line.issuedQuantity ?? 0) === 0 && (line.requestedQuantity ?? 0) > 0)
  );
}

export function isMyJobEvidenceNeeded(job: MyJobMatchInput) {
  if (isTerminalMyJobStatus(job.status)) return false;
  const attachments = job.evidenceAttachments ?? [];
  if (attachments.some((item) => item.verificationStatus === EvidenceVerificationStatus.REJECTED)) return true;
  if (!job.type) return false;
  const checklist = evaluateEvidenceRequirements(job.type as WorkOrderType, attachments);
  return checklist.required && !checklist.complete;
}

export function matchesMyJobView(job: MyJobMatchInput, view: MyJobView, now = new Date()) {
  if (view === "active") return !isTerminalMyJobStatus(job.status);
  if (view === "completed") return job.status === "COMPLETED" || job.status === "CLOSED";
  if (view === "in-progress") return job.status === "IN_PROGRESS";
  if (view === "overdue") return isMyJobOverdue(job, now);
  if (view === "waiting-parts") return isMyJobWaitingParts(job);
  if (view === "evidence-needed") return isMyJobEvidenceNeeded(job);
  if (view === "rework-required") return job.status === "REWORK_REQUIRED";
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
