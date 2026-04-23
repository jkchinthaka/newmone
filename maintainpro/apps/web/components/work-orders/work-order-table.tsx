"use client";

import { ArrowUpDown, CheckCircle2, Pencil, Trash2 } from "lucide-react";

import {
  formatDate,
  getAssetLabel,
  getPriorityClass,
  getStatusClass,
  getTechnicianName,
  isWorkOrderOverdue,
  toTitleCase
} from "./helpers";
import {
  WORK_ORDER_STATUSES,
  type SortDirection,
  type TechnicianOption,
  type WorkOrder,
  type WorkOrderSortField,
  type WorkOrderStatus
} from "./types";

type WorkOrderTableProps = {
  rows: WorkOrder[];
  technicians: TechnicianOption[];
  selectedIds: string[];
  sortBy: WorkOrderSortField;
  sortDirection: SortDirection;
  onSortChange: (field: WorkOrderSortField) => void;
  onToggleSelect: (workOrderId: string, checked: boolean) => void;
  onToggleSelectAll: (ids: string[], checked: boolean) => void;
  onStatusChange: (workOrder: WorkOrder, status: WorkOrderStatus) => void;
  onAssign: (workOrder: WorkOrder, technicianId: string) => void;
  onComplete: (workOrder: WorkOrder) => void;
  onDelete: (workOrder: WorkOrder) => void;
  onEdit: (workOrder: WorkOrder) => void;
};

type HeaderCell = {
  key: WorkOrderSortField;
  label: string;
};

const HEADER_CELLS: HeaderCell[] = [
  { key: "woNumber", label: "WO Number" },
  { key: "title", label: "Title" },
  { key: "asset", label: "Asset" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "technician", label: "Technician" },
  { key: "dueDate", label: "Due Date" }
];

export function WorkOrderTable({
  rows,
  technicians,
  selectedIds,
  sortBy,
  sortDirection,
  onSortChange,
  onToggleSelect,
  onToggleSelectAll,
  onStatusChange,
  onAssign,
  onComplete,
  onDelete,
  onEdit
}: WorkOrderTableProps) {
  const selectableIds = rows.map((row) => row.id);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-[1020px] w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) => onToggleSelectAll(selectableIds, event.target.checked)}
                />
              </th>
              {HEADER_CELLS.map((cell) => (
                <th key={cell.key} className="px-3 py-3 text-left">
                  <button
                    type="button"
                    onClick={() => onSortChange(cell.key)}
                    className="inline-flex items-center gap-1 font-semibold text-slate-600"
                  >
                    {cell.label}
                    <ArrowUpDown
                      size={12}
                      className={
                        sortBy === cell.key
                          ? "text-brand-600"
                          : "text-slate-400"
                      }
                    />
                    {sortBy === cell.key ? (
                      <span className="text-[10px] text-brand-600">{sortDirection.toUpperCase()}</span>
                    ) : null}
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-slate-500">
                  No work orders found for the active filter set.
                </td>
              </tr>
            ) : (
              rows.map((workOrder) => {
                const overdue = isWorkOrderOverdue(workOrder);

                return (
                  <tr key={workOrder.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(workOrder.id)}
                        onChange={(event) => onToggleSelect(workOrder.id, event.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-3 font-semibold text-brand-700">{workOrder.woNumber}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{workOrder.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{workOrder.description}</p>
                    </td>
                    <td className="px-3 py-3">{getAssetLabel(workOrder)}</td>
                    <td className="px-3 py-3">
                      <select
                        value={workOrder.status}
                        onChange={(event) => {
                          const nextStatus = event.target.value as WorkOrderStatus;
                          if (nextStatus === "COMPLETED") {
                            onComplete(workOrder);
                            return;
                          }
                          onStatusChange(workOrder, nextStatus);
                        }}
                        className={`rounded-md border border-slate-300 px-2 py-1 text-xs ring-1 ${getStatusClass(workOrder.status)}`}
                      >
                        {WORK_ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {toTitleCase(status)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(workOrder.priority)}`}>
                        {toTitleCase(workOrder.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-600">{getTechnicianName(workOrder)}</p>
                        <select
                          value={workOrder.technicianId ?? ""}
                          onChange={(event) => {
                            if (!event.target.value) {
                              return;
                            }
                            onAssign(workOrder, event.target.value);
                          }}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Assign technician...</option>
                          {technicians.map((technician) => (
                            <option key={technician.id} value={technician.id}>
                              {technician.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={overdue ? "font-semibold text-rose-700" : "text-slate-700"}>{formatDate(workOrder.dueDate)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(workOrder)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onComplete(workOrder)}
                          disabled={workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED"}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <CheckCircle2 size={12} /> Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(workOrder)}
                          className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
