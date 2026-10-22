"use client";

import type { KeyboardEvent } from "react";

import {
  assigneeLine,
  domainJobsColumns,
  odometerLine,
  registrationLine,
  serviceTypeLine,
  workSubtitle,
  type DomainJobListRow
} from "@/lib/domain-jobs-columns";
import { holdReasonSuffix, queueNextControl } from "@/lib/batch-3-presentation";
import { priorityBadgePresentation } from "@/lib/dashboard-status";
import { formatQueueDue, nextActionLabel } from "@/lib/work-order-queue-nav";
import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";
import { jobDomainLabel } from "@/lib/job-domain";
import { StatusBadge } from "@/components/ui/dashboard";

import { getTechnicianName } from "./helpers";

type Props = {
  rows: WorkOrderQueueItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpen: (row: WorkOrderQueueItem) => void;
  onAction?: (row: WorkOrderQueueItem, actionId: string) => void;
  actorRole?: string | null;
  canBulkSelect?: boolean;
  jobDomain?: string;
};

const primaryButtonClass =
  "inline-flex min-h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const viewButtonClass =
  "inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

function openFromKeyboard(event: KeyboardEvent<HTMLTableRowElement>, row: WorkOrderQueueItem, onOpen: (row: WorkOrderQueueItem) => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  onOpen(row);
}

export function WorkOrderCompactTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onAction,
  actorRole,
  canBulkSelect = false,
  jobDomain
}: Props) {
  const columns = domainJobsColumns(jobDomain);
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="hidden md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              {canBulkSelect ? (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => onToggleSelectAll(event.target.checked)}
                    aria-label="Select all work orders"
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2 font-medium ${column.key === "actions" ? "hidden" : ""} ${column.hideUntilXl ? "hidden xl:table-cell" : ""}`}
                >
                  {column.key === "actions" ? <span className="sr-only">{column.label}</span> : column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const due = formatQueueDue(row.dueDate, row.overdueDays);
              const next = nextActionLabel(row);
              const control = queueNextControl({ status: row.status, role: actorRole, approvalStatus: row.approvalStatus });
              const priority = priorityBadgePresentation(row.priority);
              const hold = holdReasonSuffix(
                row.status,
                (row as { holdNotes?: string | null }).holdNotes,
                (row as { holdReasonCode?: string | null }).holdReasonCode
              );
              const domainRow = row as WorkOrderQueueItem & DomainJobListRow;
              const subtitle = workSubtitle(domainRow, jobDomain);
              const domain = jobDomain ? "" : jobDomainLabel(row.jobDomain);
              const highRisk = row.riskSeverity === "HIGH" || row.riskSeverity === "CRITICAL";
              const mileage = jobDomain === "VEHICLE" ? odometerLine(domainRow) : "";
              return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => onOpen(row)}
                  onKeyDown={(event) => openFromKeyboard(event, row, onOpen)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500"
                  aria-label={`Open ${row.woNumber}`}
                >
                  {canBulkSelect ? (
                    <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => onToggleSelect(row.id)}
                        aria-label={`Select ${row.woNumber}`}
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 align-top">
                    <div className="font-semibold text-slate-900">{row.woNumber}</div>
                    {highRisk ? (
                      <div className="text-xs font-medium text-red-700" aria-label={`${row.riskSeverity} risk`}>
                        {row.riskSeverity} risk
                      </div>
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-3 align-top">
                    <div className="font-medium text-slate-900">{row.title}</div>
                    <div className="truncate text-slate-500">
                      {subtitle}
                      {domain && domain !== "—" ? ` · ${domain}` : ""}
                    </div>
                  </td>
                  {jobDomain === "SERVICE" ? (
                    <td className="hidden max-w-[10rem] truncate px-3 py-3 align-top text-slate-700 xl:table-cell">
                      {serviceTypeLine(domainRow)}
                    </td>
                  ) : null}
                  {jobDomain === "VEHICLE" ? (
                    <td className="hidden px-3 py-3 align-top text-slate-700 xl:table-cell">{registrationLine(domainRow)}</td>
                  ) : null}
                  <td className="px-3 py-3 align-top">
                    <StatusBadge status={row.status} />
                    {hold ? <div className="mt-1 max-w-[12rem] text-xs text-amber-800">{hold}</div> : null}
                  </td>
                  <td className="px-3 py-3 align-top">{priority ? <StatusBadge status={row.priority} label={priority.label} tone={priority.tone} /> : null}</td>
                  <td className="max-w-[12rem] truncate px-3 py-3 align-top text-slate-700">
                    {assigneeLine(domainRow, jobDomain, getTechnicianName(row))}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className={due.overdue ? "font-medium text-red-700" : "text-slate-800"}>{due.date}</div>
                    {due.hint ? (
                      <div className={`text-xs ${due.overdue ? "text-red-700" : "text-slate-500"}`}>{due.hint}</div>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] px-3 py-3 align-top">
                    {mileage ? <div className="mb-1 text-xs text-slate-500">{mileage}</div> : null}
                    <div className="sr-only">{next.label}</div>
                    {control.kind === "action" ? (
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={(event) => {
                          event.stopPropagation();
                          onAction?.(row, control.actionId);
                        }}
                      >
                        {control.label}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={viewButtonClass}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(row);
                        }}
                      >
                        View
                      </button>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-right align-top">
                    <span className="sr-only">Open</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
