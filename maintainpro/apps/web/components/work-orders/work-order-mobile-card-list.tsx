"use client";

import {
  assigneeLine,
  odometerLine,
  registrationLine,
  serviceTypeLine,
  workSubtitle,
  type DomainJobListRow
} from "@/lib/domain-jobs-columns";
import { StatusBadge } from "@/components/ui/dashboard";
import { holdReasonSuffix, queueNextControl } from "@/lib/batch-3-presentation";
import { priorityBadgePresentation } from "@/lib/dashboard-status";
import { formatQueueDue } from "@/lib/work-order-queue-nav";
import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";

import { getTechnicianName } from "./helpers";

type Props = {
  rows: WorkOrderQueueItem[];
  onOpen: (row: WorkOrderQueueItem) => void;
  onAction?: (row: WorkOrderQueueItem, actionId: string) => void;
  actorRole?: string | null;
  jobDomain?: string;
};

/** Stacked work-order rows for narrow screens. */
export function WorkOrderMobileCardList({ rows, onOpen, onAction, actorRole, jobDomain }: Props) {
  return (
    <div className="space-y-2 p-2 md:hidden">
      {rows.map((row) => {
        const due = formatQueueDue(row.dueDate, row.overdueDays);
        const control = queueNextControl({ status: row.status, role: actorRole, approvalStatus: row.approvalStatus });
        const priority = priorityBadgePresentation(row.priority);
        const hold = holdReasonSuffix(
          row.status,
          (row as { holdNotes?: string | null }).holdNotes,
          (row as { holdReasonCode?: string | null }).holdReasonCode
        );
        const domainRow = row as WorkOrderQueueItem & DomainJobListRow;
        const mileage = jobDomain === "VEHICLE" ? odometerLine(domainRow) : "";
        return (
          <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-900">{row.woNumber}</span>
              {priority ? <StatusBadge status={row.priority} label={priority.label} tone={priority.tone} /> : null}
            </div>
            <p className="mt-1 font-medium text-slate-900">{row.title}</p>
            <p className="text-sm text-slate-500">{workSubtitle(domainRow, jobDomain)}</p>
            {jobDomain === "SERVICE" ? <p className="text-sm text-slate-600">{serviceTypeLine(domainRow)}</p> : null}
            {jobDomain === "VEHICLE" ? <p className="text-sm text-slate-600">{registrationLine(domainRow)}</p> : null}
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={row.status} />
                  {hold ? <span className="mt-1 block text-xs text-amber-800">{hold}</span> : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Due</dt>
                <dd className={due.overdue ? "text-red-700" : undefined}>
                  {due.date}
                  {due.hint ? ` · ${due.hint}` : ""}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Assignee</dt>
                <dd>{assigneeLine(domainRow, jobDomain, getTechnicianName(row))}</dd>
              </div>
            </dl>
            {mileage ? <p className="mt-1 text-xs text-slate-500">{mileage}</p> : null}
            {/* View is always available so a phone user can read the job before acting on it. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {control.kind === "action" ? (
                <button type="button" className="inline-flex min-h-10 items-center rounded-md bg-brand-600 px-3 text-sm font-semibold text-white" onClick={() => onAction?.(row, control.actionId)}>
                  {control.label}
                </button>
              ) : null}
              <button type="button" aria-label={`Open ${row.woNumber}`} className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800" onClick={() => onOpen(row)}>
                View
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
