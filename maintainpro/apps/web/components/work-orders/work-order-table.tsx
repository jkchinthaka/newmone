"use client";

import { TouchCheckbox } from "@/components/ui/touch-checkbox";
import { Pencil, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/dashboard";
import { priorityBadgePresentation } from "@/lib/dashboard-status";
import { getValidWorkOrderActions } from "@/lib/work-order-actions";
import { canManageWorkOrders, primaryWorkOrderAction, secondaryWorkOrderActions } from "@/lib/work-order-next-action";

import {
  formatDate,
  getAssetLabel,
  getTechnicianName,
  isWorkOrderOverdue
} from "./helpers";
import {
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
  /** Cancel action. Left out for roles the API does not allow to cancel. */
  onDelete?: (workOrder: WorkOrder) => void;
  onEdit: (workOrder: WorkOrder) => void;
  actorRole?: string | null;
  /** Hides Approve & assign on jobs this user created (another manager must approve). */
  currentUserId?: string | null;
  onPrimary?: (workOrder: WorkOrder, actionId?: string) => void;
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
  onEdit,
  actorRole,
  currentUserId,
  onPrimary
}: WorkOrderTableProps) {
  void onStatusChange;
  void onComplete;
  const selectableIds = rows.map((row) => row.id);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  const columns: DataTableColumn<WorkOrder>[] = [
    {
      id: "woNumber",
      header: "WO Number",
      mobileLabel: "WO Number",
      sortable: true,
      cell: (workOrder) => (
        <div>
          <span className="font-semibold text-brand-700">{workOrder.woNumber}</span>
        </div>
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
      cell: (workOrder) => <StatusBadge status={workOrder.status} />
    },
    {
      id: "priority",
      header: "Priority",
      mobileLabel: "Priority",
      sortable: true,
      cell: (workOrder) => {
        const priority = priorityBadgePresentation(workOrder.priority);
        return priority ? <StatusBadge status={workOrder.priority} label={priority.label} tone={priority.tone} /> : null;
      }
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
            className="min-h-11 w-full rounded-md border border-slate-300 px-2 text-sm"
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
        <TouchCheckbox
          checked={allChecked}
          label="Select all work orders on this page"
          onChange={(event) => onToggleSelectAll(selectableIds, event.target.checked)}
        />
      }
      minWidth="1020px"
      onSortChange={(columnId) => onSortChange(columnId as WorkOrderSortField)}
      renderActions={(workOrder) => {
        if (!canManageWorkOrders(actorRole)) return null;
        const next = primaryWorkOrderAction({
          status: workOrder.status,
          role: actorRole,
          approvalStatus: workOrder.approvalStatus
        });
        const more = secondaryWorkOrderActions({ status: workOrder.status, role: actorRole });
        return (
        <div className="flex flex-wrap items-center gap-1">
          {next ? (
            <span className="inline-flex flex-col">
              <button
                type="button"
                disabled={Boolean(next.disabledReason)}
                onClick={() => onPrimary?.(workOrder, next.id)}
                className="inline-flex min-h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {next.label}
              </button>
              {/* Shown as text so phones see why the button is off. */}
              {next.disabledReason ? <span className="mt-1 max-w-[220px] text-[11px] leading-4 text-slate-600">{next.disabledReason}</span> : null}
            </span>
          ) : null}
          {workOrder.approvalStatus === "PENDING" &&
          workOrder.status === "OPEN" &&
          !(currentUserId && workOrder.createdById === currentUserId) &&
          ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"].includes(actorRole ?? "") ? (
            <button
              type="button"
              onClick={() => onPrimary?.(workOrder, "approve-assign")}
              className="inline-flex min-h-9 items-center rounded-md bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
            >
              Approve & assign
            </button>
          ) : null}
          <details className="relative">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border border-slate-300 px-2 text-xs text-slate-700">More</summary>
            <div className="mt-1 flex flex-wrap gap-1">
          {more.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onPrimary?.(workOrder, action.id)}
              className="inline-flex min-h-11 items-center rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
            >
              {action.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onEdit(workOrder)}
            className="inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            <Pencil size={12} /> Edit
          </button>
          {onDelete && getValidWorkOrderActions(workOrder.status).some((descriptor) => descriptor.action === "CANCEL") ? (
            <button
              type="button"
              onClick={() => onDelete(workOrder)}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
            >
              <Trash2 size={12} /> Cancel
            </button>
          ) : null}
            </div>
          </details>
        </div>
        );
      }}
      renderLeadingCell={(workOrder) => (
        <TouchCheckbox
          checked={selectedIds.includes(workOrder.id)}
          label={`Select work order ${workOrder.woNumber}`}
          onChange={(event) => onToggleSelect(workOrder.id, event.target.checked)}
        />
      )}
      rows={rows}
      sortDirection={sortDirection}
      sortKey={sortBy}
    />
  );
}
