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
import { formatQueueDue, nextActionLabel } from "@/lib/work-order-queue-nav";
import type { WorkOrderQueueItem } from "@/lib/work-order-queues-api";
import { jobDomainLabel } from "@/lib/job-domain";

import { getTechnicianName, humanWorkOrderStatusLabel, toTitleCase } from "./helpers";

type Props = {
  rows: WorkOrderQueueItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpen: (row: WorkOrderQueueItem) => void;
  canBulkSelect?: boolean;
  jobDomain?: string;
};

function statusClass(status: string) {
  if (status === "OVERDUE" || status === "REWORK_REQUIRED") return "text-red-700";
  if (status === "ON_HOLD" || status === "TECHNICIAN_COMPLETED") return "text-amber-800";
  if (status === "COMPLETED" || status === "CLOSED" || status === "VERIFIED") return "text-emerald-800";
  return "text-slate-800";
}

function priorityClass(priority: string) {
  if (priority === "CRITICAL") return "font-semibold text-red-700";
  if (priority === "HIGH") return "font-semibold text-amber-800";
  return "text-slate-700";
}

function actionClass(tone: "critical" | "warn" | "ok" | "neutral") {
  if (tone === "critical") return "text-red-700";
  if (tone === "warn") return "text-amber-800";
  if (tone === "ok") return "text-emerald-800";
  return "text-slate-600";
}

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
                  className={`px-3 py-2 font-medium ${column.hideUntilXl ? "hidden xl:table-cell" : ""}`}
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
                  <td className={`px-3 py-3 align-top font-medium ${statusClass(row.status)}`}>
                    {humanWorkOrderStatusLabel(row.status)}
                  </td>
                  <td className={`px-3 py-3 align-top ${priorityClass(row.priority)}`}>{toTitleCase(row.priority)}</td>
                  <td className="max-w-[12rem] truncate px-3 py-3 align-top text-slate-700">
                    {assigneeLine(domainRow, jobDomain, getTechnicianName(row))}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className={due.overdue ? "font-medium text-red-700" : "text-slate-800"}>{due.date}</div>
                    {due.hint ? (
                      <div className={`text-xs ${due.overdue ? "text-red-700" : "text-slate-500"}`}>{due.hint}</div>
                    ) : null}
                  </td>
                  <td className={`max-w-[12rem] px-3 py-3 align-top ${actionClass(next.tone)}`}>
                    {mileage ? <div className="text-xs text-slate-500">{mileage}</div> : null}
                    <div>{next.label}</div>
                  </td>
                  <td className="px-3 py-3 text-right align-top" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="rounded-md px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    >
                      Open
                    </button>
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
