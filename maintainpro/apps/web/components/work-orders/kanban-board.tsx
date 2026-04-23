"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import { toTitleCase } from "./helpers";
import { WorkOrderCard } from "./work-order-card";
import { STATUS_ORDER, type TechnicianOption, type WorkOrder, type WorkOrderStatus } from "./types";

type KanbanBoardProps = {
  groupedWorkOrders: Record<WorkOrderStatus, WorkOrder[]>;
  technicians: TechnicianOption[];
  onMoveToStatus: (workOrder: WorkOrder, status: WorkOrderStatus) => void;
  onStart: (workOrder: WorkOrder) => void;
  onHold: (workOrder: WorkOrder) => void;
  onComplete: (workOrder: WorkOrder) => void;
  onAssign: (workOrder: WorkOrder, technicianId: string) => void;
  onDelete: (workOrder: WorkOrder) => void;
  onEdit: (workOrder: WorkOrder) => void;
};

const columnAccent: Record<WorkOrderStatus, string> = {
  OPEN: "border-slate-300 bg-slate-100/80",
  IN_PROGRESS: "border-sky-300 bg-sky-50",
  ON_HOLD: "border-amber-300 bg-amber-50",
  COMPLETED: "border-emerald-300 bg-emerald-50",
  CANCELLED: "border-slate-300 bg-slate-100",
  OVERDUE: "border-rose-300 bg-rose-50"
};

export function KanbanBoard({
  groupedWorkOrders,
  technicians,
  onMoveToStatus,
  onStart,
  onHold,
  onComplete,
  onAssign,
  onDelete,
  onEdit
}: KanbanBoardProps) {
  const [draggingOrder, setDraggingOrder] = useState<WorkOrder | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<WorkOrderStatus | null>(null);

  const hasRows = useMemo(
    () => STATUS_ORDER.some((status) => (groupedWorkOrders[status] ?? []).length > 0),
    [groupedWorkOrders]
  );

  if (!hasRows) {
    return (
      <div className="card grid min-h-[280px] place-items-center text-center text-sm text-slate-500">
        No work orders match current filters. Adjust filters or create a new work order.
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
      {STATUS_ORDER.map((status, columnIndex) => {
        const rows = groupedWorkOrders[status] ?? [];
        const highlighted = dragOverStatus === status;

        return (
          <motion.section
            key={status}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: columnIndex * 0.03 }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverStatus(status);
            }}
            onDragLeave={() => {
              if (dragOverStatus === status) {
                setDragOverStatus(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingOrder && draggingOrder.status !== status) {
                onMoveToStatus(draggingOrder, status);
              }
              setDraggingOrder(null);
              setDragOverStatus(null);
            }}
            className={`rounded-xl border p-3 ${columnAccent[status]} ${highlighted ? "ring-2 ring-brand-300" : ""}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{toTitleCase(status)}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {rows.length}
              </span>
            </div>

            <div className="space-y-2">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-8 text-center text-xs text-slate-500">
                  Drop here
                </div>
              ) : (
                rows.map((workOrder) => (
                  <motion.div key={workOrder.id} layout>
                    <WorkOrderCard
                      workOrder={workOrder}
                      technicians={technicians}
                      dragging={draggingOrder?.id === workOrder.id}
                      onStart={onStart}
                      onHold={onHold}
                      onComplete={onComplete}
                      onAssign={onAssign}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      onDragStart={setDraggingOrder}
                      onDragEnd={() => {
                        setDraggingOrder(null);
                        setDragOverStatus(null);
                      }}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
