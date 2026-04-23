"use client";

import { CalendarClock, GripVertical, PauseCircle, PlayCircle, Trash2, UserRound, CheckCircle2, Pencil } from "lucide-react";

import {
  formatDate,
  getAssetLabel,
  getPriorityClass,
  getStatusClass,
  getTechnicianName,
  isWorkOrderOverdue,
  toTitleCase
} from "./helpers";
import type { TechnicianOption, WorkOrder } from "./types";

type WorkOrderCardProps = {
  workOrder: WorkOrder;
  technicians: TechnicianOption[];
  dragging?: boolean;
  onStart: (workOrder: WorkOrder) => void;
  onHold: (workOrder: WorkOrder) => void;
  onComplete: (workOrder: WorkOrder) => void;
  onAssign: (workOrder: WorkOrder, technicianId: string) => void;
  onDelete: (workOrder: WorkOrder) => void;
  onEdit: (workOrder: WorkOrder) => void;
  onDragStart: (workOrder: WorkOrder) => void;
  onDragEnd: () => void;
};

export function WorkOrderCard({
  workOrder,
  technicians,
  dragging,
  onStart,
  onHold,
  onComplete,
  onAssign,
  onDelete,
  onEdit,
  onDragStart,
  onDragEnd
}: WorkOrderCardProps) {
  const overdue = isWorkOrderOverdue(workOrder);

  return (
    <article
      draggable
      onDragStart={() => onDragStart(workOrder)}
      onDragEnd={onDragEnd}
      className={`rounded-xl border bg-white p-3 shadow-sm transition-all duration-150 ${
        dragging ? "cursor-grabbing border-brand-400 opacity-60" : "cursor-grab border-slate-200 hover:border-brand-300"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-brand-700">{workOrder.woNumber}</p>
          <p className="text-sm font-semibold text-slate-900">{workOrder.title}</p>
          <p className="text-xs text-slate-500">{getAssetLabel(workOrder)}</p>
        </div>

        <div className="flex items-center gap-1">
          <span className="rounded-md border border-slate-200 bg-slate-50 p-1 text-slate-400">
            <GripVertical size={12} />
          </span>
          <button
            type="button"
            onClick={() => onEdit(workOrder)}
            className="rounded-md border border-slate-200 bg-slate-50 p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Edit work order"
          >
            <Pencil size={12} />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-medium ring-1 ${getPriorityClass(workOrder.priority)}`}>
          {toTitleCase(workOrder.priority)}
        </span>
        <span className={`rounded-full px-2 py-1 font-medium ring-1 ${getStatusClass(workOrder.status)}`}>
          {toTitleCase(workOrder.status)}
        </span>
        {overdue ? (
          <span className="rounded-full bg-rose-100 px-2 py-1 font-medium text-rose-700 ring-1 ring-rose-200">
            SLA Risk
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-200">
            SLA OK
          </span>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <div className="flex items-center gap-1">
          <CalendarClock size={12} className={overdue ? "text-rose-600" : "text-slate-500"} />
          <span className={overdue ? "font-semibold text-rose-700" : ""}>Due: {formatDate(workOrder.dueDate)}</span>
        </div>
        <div className="flex items-center gap-1">
          <UserRound size={12} className="text-slate-500" />
          <span>{getTechnicianName(workOrder)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => onStart(workOrder)}
          disabled={workOrder.status === "IN_PROGRESS" || workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED"}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <PlayCircle size={12} /> Start
        </button>
        <button
          type="button"
          onClick={() => onHold(workOrder)}
          disabled={workOrder.status === "ON_HOLD" || workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED"}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <PauseCircle size={12} /> Hold
        </button>
        <button
          type="button"
          onClick={() => onComplete(workOrder)}
          disabled={workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED"}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <CheckCircle2 size={12} /> Complete
        </button>
      </div>

      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <select
          value={workOrder.technicianId ?? ""}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            onAssign(workOrder, event.target.value);
          }}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
        >
          <option value="">Assign technician...</option>
          {technicians.map((technician) => (
            <option key={technician.id} value={technician.id}>
              {technician.fullName}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDelete(workOrder)}
          className="inline-flex items-center justify-center rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
          aria-label="Delete work order"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </article>
  );
}
