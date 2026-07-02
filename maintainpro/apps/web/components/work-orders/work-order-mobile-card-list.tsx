"use client";

import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";

import {
  formatDate,
  getAssetLabel,
  getPriorityClass,
  getStatusClass,
  getTechnicianName,
  toTitleCase
} from "./helpers";

function categoryPath(row: WorkOrderQueueItem) {
  const parts = [row.categoryNameSnapshot, row.typeNameSnapshot, row.issueNameSnapshot].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Unclassified / Legacy";
}

type Props = {
  rows: WorkOrderQueueItem[];
  onOpen: (row: WorkOrderQueueItem) => void;
};

export function WorkOrderMobileCardList({ rows, onOpen }: Props) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {rows.map((row) => {
        const primaryAction = row.actionRequired?.[0];
        return (
          <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand-700">{row.woNumber}</p>
                <p className="mt-1 font-medium text-slate-900">{row.title}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${getPriorityClass(row.priority)}`}>
                {toTitleCase(row.priority)}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusClass(row.status)}`}>
                {toTitleCase(row.status.replaceAll("_", " "))}
              </span>
              {primaryAction ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {primaryAction.label}
                </span>
              ) : null}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="font-medium text-slate-800">{categoryPath(row)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Due</dt>
                <dd className="font-medium text-slate-800">
                  {formatDate(row.dueDate)}
                  {row.overdueDays && row.overdueDays > 0 ? ` (${row.overdueDays}d overdue)` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Asset</dt>
                <dd className="font-medium text-slate-800">{getAssetLabel(row)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Assignee</dt>
                <dd className="font-medium text-slate-800">{row.primaryAssigneeName ?? getTechnicianName(row)}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => onOpen(row)}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Open work order
            </button>
          </article>
        );
      })}
    </div>
  );
}
