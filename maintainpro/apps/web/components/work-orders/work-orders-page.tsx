"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingCardSkeleton, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { USER_KEY } from "@/lib/auth-storage";
import { useCurrentUser } from "@/lib/use-current-user";

import { CompleteWorkOrderModal } from "./complete-work-order-modal";
import { getErrorMessage } from "./helpers";
import {
  useAssignWorkOrder,
  useApproveWorkOrder,
  useBulkDeleteWorkOrders,
  useBulkUpdateWorkOrderStatus,
  useCreateWorkOrder,
  useDeleteWorkOrder,
  useRejectWorkOrder,
  useTechnicians,
  useUpdateWorkOrder,
  useUpdateWorkOrderStatus,
  useWorkOrderFilters,
  useWorkOrders
} from "./hooks";
import { KanbanBoard } from "./kanban-board";
import { WorkOrderQueuePanel } from "./work-order-queue-panel";
import { WorkOrderEditorModal } from "./work-order-editor-modal";
import { WorkOrderGovernanceExceptionsCard } from "./work-order-governance-exceptions-card";
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
    <LoadingState
      description="Fetching work orders, filters, and assignment data."
      title="Loading work orders"
    >
      <LoadingCardSkeleton rows={6} />
    </LoadingState>
  );
}

export default function WorkOrdersPage() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [view, setView] = useState<WorkOrderViewMode>("queues");
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
  const [rejectTarget, setRejectTarget] = useState<WorkOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
  const approveMutation = useApproveWorkOrder();
  const rejectMutation = useRejectWorkOrder();
  const currentUser = useCurrentUser();
  const canApproveWorkOrders = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"].includes(
    currentUser.role ?? ""
  );

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
      toast.success(
        status === "IN_PROGRESS"
          ? `${workOrder.woNumber} moved to In Progress`
          : `Status updated to ${status.replaceAll("_", " ")}`
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (workOrder: WorkOrder) => {
    const confirmed = await confirm({
      title: `Delete ${workOrder.woNumber}?`,
      description: "This work order will be permanently removed. This action cannot be undone.",
      confirmLabel: "Delete work order",
      cancelLabel: "Keep work order",
      variant: "destructive"
    });
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

  const handleApprove = async (workOrder: WorkOrder) => {
    try {
      await approveMutation.mutateAsync({ id: workOrder.id });
      toast.success(`${workOrder.woNumber} approved`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReject = (workOrder: WorkOrder) => {
    setRejectTarget(workOrder);
    setRejectReason("");
  };

  const submitReject = async () => {
    if (!rejectTarget) {
      return;
    }

    const reason = rejectReason.trim();
    if (reason.length < 3) {
      toast.error("Rejection reason is required (minimum 3 characters).");
      return;
    }

    try {
      await rejectMutation.mutateAsync({ id: rejectTarget.id, reason });
      toast.success(`${rejectTarget.woNumber} rejected`);
      setRejectTarget(null);
      setRejectReason("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: `Delete ${selectedIds.length} work orders?`,
      description: "Selected work orders will be permanently removed. This action cannot be undone.",
      confirmLabel: "Delete selected",
      cancelLabel: "Keep selected",
      variant: "destructive"
    });
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
      const result = await bulkStatusMutation.mutateAsync({ ids: selectedIds, status });
      if (result.success.length > 0) {
        toast.success(`Updated ${result.success.length} work order(s) to ${status.replaceAll("_", " ")}`);
      }
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} failed: ${result.failed[0]?.reason ?? "Bulk status blocked"}`);
      }
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
    if (view === "queues") {
      return (
        <WorkOrderQueuePanel
          onOpenWorkOrder={openEditModal}
          onRefreshLegacy={() => void workOrdersQuery.refetch()}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      );
    }

    if (workOrdersQuery.isLoading) {
      return <LoadingSkeleton />;
    }

    if (workOrdersQuery.error) {
      return (
        <ErrorState
          error={workOrdersQuery.error}
          onRetry={() => workOrdersQuery.refetch()}
          title="Could not load work orders"
          description={toSafeApiErrorMessage(
            workOrdersQuery.error,
            "Unable to load work orders right now."
          )}
        />
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
            canApprove={canApproveWorkOrders}
            onApprove={(workOrder) => void handleApprove(workOrder)}
            onReject={(workOrder) => void handleReject(workOrder)}
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
    handleApprove,
    handleReject,
    canApproveWorkOrders,
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
      <PageBreadcrumbs />
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

      <WorkOrderGovernanceExceptionsCard />

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
                actualHours: payload.actualHours,
                delayReason: payload.delayReason,
                completionNote: payload.completionNote
              }
            })
            .then(() => {
              toast.success("Work order submitted for supervisor verification");
              setCompletionTarget(null);
            })
            .catch((error) => {
              toast.error(getErrorMessage(error));
            });
        }}
      />

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Reject {rejectTarget.woNumber}</h2>
            <p className="mt-1 text-sm text-slate-600">Provide a reason for rejection. This cancels the work order.</p>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              rows={4}
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-100 focus:border-brand-400 focus:ring-4"
              placeholder="Reason for rejection"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending}
                onClick={() => void submitReject()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                Reject work order
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? <div className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Processing...</div> : null}
      {confirmDialog}
    </div>
  );
}
