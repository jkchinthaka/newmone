"use client";

import { CheckCircle2, Pencil, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

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

  const columns: DataTableColumn<WorkOrder>[] = [
    {
      id: "woNumber",
      header: "WO Number",
      mobileLabel: "WO Number",
      sortable: true,
      cell: (workOrder) => (
        <span className="font-semibold text-brand-700">{workOrder.woNumber}</span>
      )
    },
    {
      id: "title",
      header: "Title",
      mobileLabel: "Title",
      sortable: true,
      cell: (workOrder) => (
        <div>
          <p className="font-medium text-slate-900">{workOrder.title}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{workOrder.description}</p>
        </div>
      )
    },
    {
      id: "asset",
      header: "Asset",
      mobileLabel: "Asset",
      sortable: true,
      cell: (workOrder) => getAssetLabel(workOrder)
    },
    {
      id: "status",
      header: "Status",
      mobileLabel: "Status",
      sortable: true,
      cell: (workOrder) => (
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
      )
    },
    {
      id: "priority",
      header: "Priority",
      mobileLabel: "Priority",
      sortable: true,
      cell: (workOrder) => (
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getPriorityClass(workOrder.priority)}`}>
          {toTitleCase(workOrder.priority)}
        </span>
      )
    },
    {
      id: "technician",
      header: "Technician",
      mobileLabel: "Technician",
      sortable: true,
      cell: (workOrder) => (
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
      )
    },
    {
      id: "dueDate",
      header: "Due Date",
      mobileLabel: "Due Date",
      sortable: true,
      cell: (workOrder) => {
        const overdue = isWorkOrderOverdue(workOrder);
        return (
          <span className={overdue ? "font-semibold text-rose-700" : "text-slate-700"}>
            {formatDate(workOrder.dueDate)}
          </span>
        );
      }
    }
  ];

  return (
    <DataTable
      ariaLabel="Work orders"
      className="card border-0 shadow-none md:rounded-xl md:border md:border-slate-200 md:shadow-sm"
      columns={columns}
      emptyDescription="Adjust filters or create a new work order to get started."
      emptyTitle="No work orders found"
      getRowId={(row) => row.id}
      leadingHeader={
        <input
          type="checkbox"
          checked={allChecked}
          aria-label="Select all work orders on this page"
          onChange={(event) => onToggleSelectAll(selectableIds, event.target.checked)}
        />
      }
      minWidth="1020px"
      onSortChange={(columnId) => onSortChange(columnId as WorkOrderSortField)}
      renderActions={(workOrder) => (
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(workOrder)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            type="button"
            onClick={() => onComplete(workOrder)}
            disabled={workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED"}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            <CheckCircle2 size={12} /> Complete
          </button>
          <button
            type="button"
            onClick={() => onDelete(workOrder)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
      renderLeadingCell={(workOrder) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(workOrder.id)}
          aria-label={`Select work order ${workOrder.woNumber}`}
          onChange={(event) => onToggleSelect(workOrder.id, event.target.checked)}
        />
      )}
      rows={rows}
      sortDirection={sortDirection}
      sortKey={sortBy}
    />
  );
}
