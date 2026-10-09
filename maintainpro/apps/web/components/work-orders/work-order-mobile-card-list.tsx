"use client";

import {
  assigneeLine,
  odometerLine,
  registrationLine,
  serviceTypeLine,
  workSubtitle,
  type DomainJobListRow
} from "@/lib/domain-jobs-columns";
import { formatQueueDue, nextActionLabel } from "@/lib/work-order-queue-nav";
import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";

import { getTechnicianName, humanWorkOrderStatusLabel, toTitleCase } from "./helpers";

type Props = {
  rows: WorkOrderQueueItem[];
  onOpen: (row: WorkOrderQueueItem) => void;
  jobDomain?: string;
};

/** Stacked work-order rows for narrow screens. */
export function WorkOrderMobileCardList({ rows, onOpen, jobDomain }: Props) {
  return (
    <div className="space-y-2 p-2 md:hidden">
      {rows.map((row) => {
        const due = formatQueueDue(row.dueDate, row.overdueDays);
        const next = nextActionLabel(row);
        const domainRow = row as WorkOrderQueueItem & DomainJobListRow;
        const mileage = jobDomain === "VEHICLE" ? odometerLine(domainRow) : "";
        return (
          <button
            key={row.id}
            type="button"
            onClick={() => onOpen(row)}
            className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-900">{row.woNumber}</span>
              <span className={row.priority === "CRITICAL" || row.priority === "HIGH" ? "text-sm font-semibold text-amber-800" : "text-sm text-slate-600"}>
                {toTitleCase(row.priority)}
              </span>
            </div>
            <p className="mt-1 font-medium text-slate-900">{row.title}</p>
            <p className="text-sm text-slate-500">{workSubtitle(domainRow, jobDomain)}</p>
            {jobDomain === "SERVICE" ? <p className="text-sm text-slate-600">{serviceTypeLine(domainRow)}</p> : null}
            {jobDomain === "VEHICLE" ? <p className="text-sm text-slate-600">{registrationLine(domainRow)}</p> : null}
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Status</dt>
                <dd>{humanWorkOrderStatusLabel(row.status)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Due</dt>
                <dd className={due.overdue ? "text-red-700" : undefined}>
                  {due.date}
                  {due.hint ? ` · ${due.hint}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Assignee</dt>
                <dd>{assigneeLine(domainRow, jobDomain, getTechnicianName(row))}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Next action</dt>
                <dd>
                  {mileage ? `${mileage} · ` : ""}
                  {next.label}
                </dd>
              </div>
            </dl>
          </button>
        );
      })}
    </div>
  );
}
