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

function riskBadgeClass(severity?: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-900 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function categoryPath(row: WorkOrderQueueItem) {
  const parts = [row.categoryNameSnapshot, row.typeNameSnapshot, row.issueNameSnapshot].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Unclassified / Legacy";
}

type Props = {
  rows: WorkOrderQueueItem[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onOpen: (row: WorkOrderQueueItem) => void;
  canBulkSelect?: boolean;
};

export function WorkOrderCompactTable({
  rows,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  canBulkSelect = false
}: Props) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="min-w-full text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left uppercase tracking-wide text-slate-500">
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
            <th className="px-3 py-2">WO #</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Risk</th>
            <th className="px-3 py-2">Asset</th>
            <th className="px-3 py-2">Assignee</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Parts</th>
            <th className="px-3 py-2">Evidence</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row) => {
            const primaryAction = row.actionRequired?.[0];
            return (
              <tr key={row.id} className="hover:bg-slate-50">
                {canBulkSelect ? (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={() => onToggleSelect(row.id)}
                      aria-label={`Select ${row.woNumber}`}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2 font-semibold text-brand-700">{row.woNumber}</td>
                <td className="max-w-[12rem] truncate px-3 py-2 font-medium text-slate-900">{row.title}</td>
                <td className="max-w-[10rem] truncate px-3 py-2 text-slate-600">{categoryPath(row)}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${getStatusClass(row.status)}`}>
                    {toTitleCase(row.status.replaceAll("_", " "))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${getPriorityClass(row.priority)}`}>
                    {toTitleCase(row.priority)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${riskBadgeClass(row.riskSeverity)}`}>
                    {row.riskSeverity ?? "LOW"}
                  </span>
                </td>
                <td className="max-w-[8rem] truncate px-3 py-2">{getAssetLabel(row)}</td>
                <td className="max-w-[8rem] truncate px-3 py-2">
                  {row.primaryAssigneeName ?? getTechnicianName(row)}
                </td>
                <td className="px-3 py-2">
                  {formatDate(row.dueDate)}
                  {row.overdueDays && row.overdueDays > 0 ? (
                    <span className="ml-1 text-[11px] font-medium text-red-700">+{row.overdueDays}d</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-slate-600">{row.partsStatus ?? "—"}</td>
                <td className="px-3 py-2 text-slate-600">{row.evidenceStatus ?? "—"}</td>
                <td className="max-w-[8rem] truncate px-3 py-2 text-amber-800">{primaryAction?.label ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="rounded border border-brand-300 px-2 py-1 text-[11px] font-medium text-brand-800 hover:bg-brand-50"
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
  );
}
