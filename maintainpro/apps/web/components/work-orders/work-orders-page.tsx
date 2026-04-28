"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { USER_KEY } from "@/lib/auth-storage";

import { CompleteWorkOrderModal } from "./complete-work-order-modal";
import { getErrorMessage } from "./helpers";
import {
  useAssignWorkOrder,
  useBulkDeleteWorkOrders,
  useBulkUpdateWorkOrderStatus,
  useCreateWorkOrder,
  useDeleteWorkOrder,
  useTechnicians,
  useUpdateWorkOrder,
  useUpdateWorkOrderStatus,
  useWorkOrderFilters,
  useWorkOrders
} from "./hooks";
import { KanbanBoard } from "./kanban-board";
import { WorkOrderEditorModal } from "./work-order-editor-modal";
import { WorkOrderFiltersBar } from "./work-order-filters-bar";
import { WorkOrderTable } from "./work-order-table";
import type { WorkOrder, WorkOrderSortField, WorkOrderStatus, WorkOrderViewMode } from "./types";

function readCurrentUserId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { id?: string | null };
    return typeof parsed.id === "string" ? parsed.id : null;
  } catch {
    return null;
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card animate-pulse space-y-3">
        <div className="h-4 w-52 rounded bg-slate-200" />
        <div className="h-10 rounded bg-slate-200" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 rounded bg-slate-200" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[220px] animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function WorkOrdersPage() {
  const [view, setView] = useState<WorkOrderViewMode>("kanban");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    workOrder: WorkOrder | null;
  }>({
    open: false,
    mode: "create",
    workOrder: null
  });
  const [completionTarget, setCompletionTarget] = useState<WorkOrder | null>(null);

  const { filters, updateFilters, resetFilters } = useWorkOrderFilters();
  const workOrdersQuery = useWorkOrders(filters);

  const techniciansQuery = useTechnicians(workOrdersQuery.sourceRows);

  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const deleteMutation = useDeleteWorkOrder();
  const statusMutation = useUpdateWorkOrderStatus();
  const assignMutation = useAssignWorkOrder();
  const bulkDeleteMutation = useBulkDeleteWorkOrders();
  const bulkStatusMutation = useBulkUpdateWorkOrderStatus();

  useEffect(() => {
    setCurrentUserId(readCurrentUserId());
  }, []);

  useEffect(() => {
    const validIds = new Set(workOrdersQuery.workOrders.map((order) => order.id));
    setSelectedIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      // Bail out if nothing actually changed, to avoid render loops if the
      // workOrders array reference flickers without content changes.
      return filtered.length === current.length ? current : filtered;
    });
  }, [workOrdersQuery.workOrders]);

  const technicians = techniciansQuery.data ?? [];

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    statusMutation.isPending ||
    assignMutation.isPending;

  const bulkBusy = bulkDeleteMutation.isPending || bulkStatusMutation.isPending;

  const openCreateModal = () => {
    setEditorState({ open: true, mode: "create", workOrder: null });
  };

  const openEditModal = (workOrder: WorkOrder) => {
    setEditorState({ open: true, mode: "edit", workOrder });
  };

  const closeEditorModal = () => {
    setEditorState((current) => ({ ...current, open: false }));
  };

  const handleStatusChange = async (workOrder: WorkOrder, status: WorkOrderStatus) => {
    if (status === "COMPLETED") {
      setCompletionTarget(workOrder);
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: workOrder.id,
        payload: { status }
      });
      toast.success(`Status updated to ${status.replaceAll("_", " ")}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (workOrder: WorkOrder) => {
    const confirmed = window.confirm(`Delete ${workOrder.woNumber}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(workOrder.id);
      toast.success("Work order deleted");
      setSelectedIds((current) => current.filter((id) => id !== workOrder.id));
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleAssign = async (workOrder: WorkOrder, technicianId: string) => {
    try {
      await assignMutation.mutateAsync({ id: workOrder.id, technicianId });
      toast.success("Technician assigned");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Delete ${selectedIds.length} selected work orders?`);
    if (!confirmed) {
      return;
    }

    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      toast.success("Selected work orders deleted");
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleBulkStatusChange = async (status: WorkOrderStatus) => {
    if (selectedIds.length === 0) {
      return;
    }

    if (status === "COMPLETED") {
      toast.error("Bulk completion requires actual cost and hours per work order.");
      return;
    }

    try {
      await bulkStatusMutation.mutateAsync({ ids: selectedIds, status });
      toast.success(`Updated ${selectedIds.length} work orders to ${status.replaceAll("_", " ")}`);
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const sortBy = filters.sortBy;
  const sortDirection = filters.sortDirection;

  const toggleSort = (field: WorkOrderSortField) => {
    if (filters.sortBy === field) {
      updateFilters({ sortDirection: filters.sortDirection === "asc" ? "desc" : "asc" });
      return;
    }

    updateFilters({ sortBy: field, sortDirection: "asc" });
  };

  const totalFiltered = workOrdersQuery.workOrders.length;

  const content = useMemo(() => {
    if (workOrdersQuery.isLoading) {
      return <LoadingSkeleton />;
    }

    if (workOrdersQuery.error) {
      return (
        <div className="card flex flex-col items-start gap-3 text-sm text-slate-600">
          <p>Unable to load work orders right now.</p>
          <button
            type="button"
            onClick={() => workOrdersQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      );
    }

    return (
      <>
        {view === "kanban" ? (
          <KanbanBoard
            groupedWorkOrders={workOrdersQuery.groupedByStatus}
            technicians={technicians}
            onMoveToStatus={handleStatusChange}
            onStart={(workOrder) => void handleStatusChange(workOrder, "IN_PROGRESS")}
            onHold={(workOrder) => void handleStatusChange(workOrder, "ON_HOLD")}
            onComplete={(workOrder) => setCompletionTarget(workOrder)}
            onAssign={(workOrder, technicianId) => void handleAssign(workOrder, technicianId)}
            onDelete={(workOrder) => void handleDelete(workOrder)}
            onEdit={openEditModal}
          />
        ) : (
          <WorkOrderTable
            rows={workOrdersQuery.workOrders}
            technicians={technicians}
            selectedIds={selectedIds}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={toggleSort}
            onToggleSelect={(id, checked) =>
              setSelectedIds((current) => {
                if (checked) {
                  return current.includes(id) ? current : [...current, id];
                }

                return current.filter((entry) => entry !== id);
              })
            }
            onToggleSelectAll={(ids, checked) => {
              if (checked) {
                setSelectedIds((current) => {
                  const merged = new Set([...current, ...ids]);
                  return [...merged];
                });
                return;
              }

              setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
            }}
            onStatusChange={(workOrder, status) => void handleStatusChange(workOrder, status)}
            onAssign={(workOrder, technicianId) => void handleAssign(workOrder, technicianId)}
            onComplete={(workOrder) => setCompletionTarget(workOrder)}
            onDelete={(workOrder) => void handleDelete(workOrder)}
            onEdit={openEditModal}
          />
        )}
      </>
    );
  }, [
    handleAssign,
    handleDelete,
    selectedIds,
    sortBy,
    sortDirection,
    technicians,
    view,
    workOrdersQuery,
    toggleSort
  ]);

  return (
    <div className="space-y-4">
      <WorkOrderFiltersBar
        filters={filters}
        technicians={technicians}
        view={view}
        selectionCount={selectedIds.length}
        bulkLoading={bulkBusy}
        onChange={updateFilters}
        onReset={resetFilters}
        onCreate={openCreateModal}
        onViewChange={setView}
        onBulkStatusChange={(status) => void handleBulkStatusChange(status)}
        onBulkDelete={() => void handleBulkDelete()}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="All" value={workOrdersQuery.stats.total} />
        <StatCard label="Open" value={workOrdersQuery.stats.open} />
        <StatCard label="In Progress" value={workOrdersQuery.stats.inProgress} />
        <StatCard label="Overdue" value={workOrdersQuery.stats.overdue} />
        <StatCard label="Completed" value={workOrdersQuery.stats.completed} />
      </section>

      <motion.section
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between px-1 text-sm text-slate-500">
          <p>{totalFiltered} work order(s) shown</p>
          {workOrdersQuery.isFetching ? (
            <p className="inline-flex items-center gap-1 text-brand-700">
              <Loader2 size={14} className="animate-spin" /> Syncing...
            </p>
          ) : null}
        </div>

        {content}
      </motion.section>

      <WorkOrderEditorModal
        open={editorState.open}
        mode={editorState.mode}
        workOrder={editorState.workOrder}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={closeEditorModal}
        onCreate={(values) => {
          if (!currentUserId) {
            toast.error("Unable to identify current user. Please login again.");
            return;
          }

          createMutation
            .mutateAsync({
              ...values,
              createdById: currentUserId
            })
            .then(() => {
              toast.success("Work order created");
              closeEditorModal();
            })
            .catch((error) => {
              toast.error(getErrorMessage(error));
            });
        }}
        onEdit={(values) => {
          if (!editorState.workOrder) {
            return;
          }

          updateMutation
            .mutateAsync({
              id: editorState.workOrder.id,
              payload: values
            })
            .then(() => {
              toast.success("Work order updated");
              closeEditorModal();
            })
            .catch((error) => {
              toast.error(getErrorMessage(error));
            });
        }}
      />

      <CompleteWorkOrderModal
        open={Boolean(completionTarget)}
        workOrder={completionTarget}
        submitting={statusMutation.isPending}
        onClose={() => setCompletionTarget(null)}
        onSubmit={(payload) => {
          if (!completionTarget) {
            return;
          }

          statusMutation
            .mutateAsync({
              id: completionTarget.id,
              payload: {
                status: "COMPLETED",
                actualCost: payload.actualCost,
                actualHours: payload.actualHours
              }
            })
            .then(() => {
              toast.success("Work order marked as completed");
              setCompletionTarget(null);
            })
            .catch((error) => {
              toast.error(getErrorMessage(error));
            });
        }}
      />

      {busy ? <div className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Processing...</div> : null}
    </div>
  );
}
