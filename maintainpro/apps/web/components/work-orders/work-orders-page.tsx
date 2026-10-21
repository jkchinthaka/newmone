"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingCardSkeleton, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { JobsViewSwitcher } from "@/components/operational/jobs-view-switcher";
import { OperationalPageHeader } from "@/components/operational/operational-page-header";
import { workOrderCreatePreset } from "@/lib/asset-list";
import { parseWorkOrderRecordLink } from "@/lib/operational-deep-link";
import { USER_KEY } from "@/lib/auth-storage";
import { canCreateWorkOrder } from "@/lib/user-role";
import { buildBulkStatusItems, remainingBulkSelection, summarizeBulkStatusResults } from "@/lib/work-order-bulk-status";
import { bulkCancelSummary, bulkCancelToast, openWorkOrderIds, type BulkCancelRow } from "./bulk-cancel";
import {
  ALLOWED_STATUS_TRANSITIONS,
  getValidWorkOrderActions,
  isAllowedKanbanDrop
} from "@/lib/work-order-actions";
import { useCurrentUser } from "@/lib/use-current-user";
import { apiClient } from "@/lib/api-client";
import { primaryWorkOrderAction, selectableWorkOrderStatuses } from "@/lib/work-order-next-action";

import { CompleteWorkOrderModal } from "./complete-work-order-modal";
import { getErrorMessage, toTitleCase } from "./helpers";
import { HoldWorkOrderModal } from "./hold-work-order-modal";
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
  useWorkOrder,
  useWorkOrderFilters,
  useWorkOrders
} from "./hooks";
import { KanbanBoard } from "./kanban-board";
import { WorkOrderQueuePanel } from "./work-order-queue-panel";
import { WorkOrderEditorModal } from "./work-order-editor-modal";
import { WorkOrderFiltersBar } from "./work-order-filters-bar";
import { WorkOrderTable } from "./work-order-table";
import { WORK_ORDER_STATUSES, type WorkOrder, type WorkOrderSortField, type WorkOrderStatus, type WorkOrderViewMode } from "./types";

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

type WorkOrdersPageProps = {
  jobDomain?: string;
  heading?: string;
  description?: string;
};

export default function WorkOrdersPage({ jobDomain, heading, description }: WorkOrdersPageProps) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [view, setView] = useState<WorkOrderViewMode>("queues");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [queueStatusRows, setQueueStatusRows] = useState<BulkCancelRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    workOrder: WorkOrder | null;
    presetAssetId?: string | null;
    presetAssetLabel?: string | null;
  }>({
    open: false,
    mode: "create",
    workOrder: null,
    presetAssetId: null,
    presetAssetLabel: null
  });
  const [completionTarget, setCompletionTarget] = useState<WorkOrder | null>(null);
  const [holdTarget, setHoldTarget] = useState<WorkOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<WorkOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const createIdempotencyKey = useRef<string | null>(null);

  const { filters, updateFilters, resetFilters } = useWorkOrderFilters();
  const effectiveFilters = jobDomain ? { ...filters, jobDomain } : filters;
  const workOrdersQuery = useWorkOrders(effectiveFilters);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const recordLink = parseWorkOrderRecordLink({
    wo: searchParams.get("wo"),
    open: searchParams.get("open"),
    tab: searchParams.get("tab")
  });
  const deepLinkId = recordLink.id;
  const deepLinkQuery = useWorkOrder(deepLinkId ?? null);

  useEffect(() => {
    if (jobDomain && filters.jobDomain !== jobDomain) {
      updateFilters({ jobDomain, page: 1 });
    }
  }, [jobDomain, filters.jobDomain, updateFilters]);

  const currentUser = useCurrentUser();
  const canLoadTechnicians = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR"].includes(
    currentUser.role ?? ""
  );
  const techniciansQuery = useTechnicians(workOrdersQuery.sourceRows, canLoadTechnicians);

  const createMutation = useCreateWorkOrder();
  const updateMutation = useUpdateWorkOrder();
  const deleteMutation = useDeleteWorkOrder();
  const statusMutation = useUpdateWorkOrderStatus();
  const assignMutation = useAssignWorkOrder();
  const bulkDeleteMutation = useBulkDeleteWorkOrders();
  const bulkStatusMutation = useBulkUpdateWorkOrderStatus();
  const approveMutation = useApproveWorkOrder();
  const rejectMutation = useRejectWorkOrder();
  const canApproveWorkOrders = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"].includes(
    currentUser.role ?? ""
  );
  const canCreateWorkOrders = canCreateWorkOrder(currentUser.role, currentUser.permissions);

  useEffect(() => {
    setCurrentUserId(readCurrentUserId());
  }, []);

  useEffect(() => {
    // Close create modal if session cannot create (role/permission change / storage refresh).
    if (!canCreateWorkOrders && editorState.open && editorState.mode === "create") {
      setEditorState((current) => ({ ...current, open: false }));
    }
  }, [canCreateWorkOrders, editorState.open, editorState.mode]);

  useEffect(() => {
    if (view === "queues") return;
    const validIds = new Set(workOrdersQuery.workOrders.map((order) => order.id));
    setSelectedIds((current) => {
      const filtered = current.filter((id) => validIds.has(id));
      // Bail out if nothing actually changed, to avoid render loops if the
      // workOrders array reference flickers without content changes.
      return filtered.length === current.length ? current : filtered;
    });
  }, [view, workOrdersQuery.workOrders]);

  const technicians = techniciansQuery.data ?? [];

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    statusMutation.isPending ||
    assignMutation.isPending;

  const bulkBusy = bulkDeleteMutation.isPending || bulkStatusMutation.isPending;

  const openCreateModal = () => {
    if (!canCreateWorkOrders) {
      return;
    }
    setEditorState({ open: true, mode: "create", workOrder: null });
  };

  const openEditModal = (workOrder: WorkOrder) => {
    setEditorState({ open: true, mode: "edit", workOrder });
  };

  const clearDeepLinkParam = () => {
    if (!searchParams.get("wo") && !searchParams.get("open") && searchParams.get("create") !== "1") {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("wo");
    params.delete("open");
    params.delete("tab");
    params.delete("create");
    params.delete("assetId");
    params.delete("assetLabel");
    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as Route);
  };

  const closeEditorModal = () => {
    createIdempotencyKey.current = null;
    setEditorState((current) => ({ ...current, open: false }));
    clearDeepLinkParam();
  };

  // Deep link support: /work-orders?wo=<id> opens the editor modal directly,
  // e.g. from the Request detail page's "Convert to Work Order" link.
  useEffect(() => {
    if (deepLinkId && deepLinkQuery.data && editorState.workOrder?.id !== deepLinkId) {
      setEditorState({ open: true, mode: "edit", workOrder: deepLinkQuery.data });
    }
  }, [deepLinkId, deepLinkQuery.data, editorState.workOrder?.id]);

  useEffect(() => {
    const preset = workOrderCreatePreset(searchParams);
    if (!preset || deepLinkId || !canCreateWorkOrders) return;
    setEditorState((current) =>
      current.open && current.mode === "create" && current.presetAssetId === preset.assetId && current.presetAssetLabel === preset.assetLabel
        ? current
        : { open: true, mode: "create", workOrder: null, presetAssetId: preset.assetId, presetAssetLabel: preset.assetLabel }
    );
  }, [canCreateWorkOrders, deepLinkId, searchParams]);

  useEffect(() => {
    if (deepLinkId && deepLinkQuery.isError) {
      toast.error("That work order could not be found or you don't have access to it.");
      clearDeepLinkParam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, deepLinkQuery.isError]);

  const handleStatusChange = async (workOrder: WorkOrder, status: WorkOrderStatus) => {
    if (status === "COMPLETED" || status === "TECHNICIAN_COMPLETED") {
      const allowed = ALLOWED_STATUS_TRANSITIONS[workOrder.status] ?? [];
      if (status === "TECHNICIAN_COMPLETED" && !allowed.includes("TECHNICIAN_COMPLETED")) {
        const actionLabels = getValidWorkOrderActions(workOrder.status).map((action) => action.label);
        toast.error(
          actionLabels.length > 0
            ? `Illegal transition. Available actions: ${actionLabels.join(", ")}.`
            : "Illegal transition. No further lifecycle actions are available."
        );
        return;
      }
      setCompletionTarget(workOrder);
      return;
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[workOrder.status] ?? [];
    if (!allowed.includes(status)) {
      const actionLabels = getValidWorkOrderActions(workOrder.status).map((action) => action.label);
      toast.error(
        actionLabels.length > 0
          ? `Illegal transition. Available actions: ${actionLabels.join(", ")}.`
          : "Illegal transition. No further lifecycle actions are available."
      );
      return;
    }

    if (status === "ON_HOLD") {
      setHoldTarget(workOrder);
      return;
    }

    try {
      await statusMutation.mutateAsync({
        id: workOrder.id,
        payload: { status, expectedVersion: workOrder.version }
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
      title: `Cancel ${workOrder.woNumber}?`,
      description:
        "This cancels the work order and keeps the historical record. It does not permanently delete the work order.",
      confirmLabel: "Cancel work order",
      cancelLabel: "Keep work order",
      variant: "destructive"
    });
    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(workOrder.id);
      toast.success("Work order cancelled");
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

  const handlePrimary = async (workOrder: WorkOrder, actionId?: string) => {
    const action = primaryWorkOrderAction({
      status: workOrder.status,
      role: currentUser.role,
      approvalStatus: workOrder.approvalStatus
    });
    const selected = actionId ?? action?.id;
    if (!selected) return;
    if (selected === action?.id && action?.disabledReason) return;
    if (selected === "send-back") {
      try {
        await apiClient.post(`/work-orders/${workOrder.id}/reject-supervisor`, {
          reason: "Sent back for rework"
        });
        toast.success(`${workOrder.woNumber} sent back`);
        await workOrdersQuery.refetch();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
      return;
    }
    if (selected === "assign") {
      toast.message("Choose a technician in the Assign list.");
      return;
    }
    if (selected === "start") {
      await handleStatusChange(workOrder, "IN_PROGRESS");
      return;
    }
    if (selected === "complete") {
      setCompletionTarget(workOrder);
      return;
    }
    try {
      const verified = await apiClient.post<{ data?: { version?: number } }>(`/work-orders/${workOrder.id}/verify-supervisor`, {
        expectedVersion: workOrder.version,
        verificationNote: "Verified from the work order list"
      });
      await apiClient.post(`/work-orders/${workOrder.id}/close`, {
        expectedVersion: verified.data?.data?.version ?? workOrder.version,
        note: "Closed after verification"
      });
      toast.success(`${workOrder.woNumber} verified and closed`);
      await workOrdersQuery.refetch();
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

  const bulkCancelRows = view === "queues" ? queueStatusRows : workOrdersQuery.workOrders;
  const cancellableIds = openWorkOrderIds(selectedIds, bulkCancelRows);

  const handleBulkDelete = async () => {
    if (bulkDeleteMutation.isPending || cancellableIds.length === 0) {
      return;
    }

    const confirmed = await confirm({
      title: "Cancel open work orders?",
      description: "Only OPEN work orders will be cancelled. Records are kept for audit.",
      confirmLabel: "Cancel open work orders",
      cancelLabel: "Keep selected",
      variant: "destructive"
    });
    if (!confirmed || bulkDeleteMutation.isPending) {
      return;
    }

    const skippedNotOpen = selectedIds.length - cancellableIds.length;
    try {
      const result = await bulkDeleteMutation.mutateAsync(cancellableIds);
      const cancelled = new Set(result.ok);
      setSelectedIds((current) => current.filter((id) => !cancelled.has(id)));
      const summary = bulkCancelToast(result.ok.length, skippedNotOpen, result.failed[0]?.message);
      if (result.failed.length > 0) {
        toast.error(summary);
      } else {
        toast.success(summary);
      }
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

    const rows = workOrdersQuery.sourceRows.length > 0 ? workOrdersQuery.sourceRows : workOrdersQuery.workOrders;
    const { items, missing } = buildBulkStatusItems(selectedIds, rows);
    if (missing.length > 0) {
      toast.error("Some selected jobs have no loaded version. Refresh the list before updating them.");
    }
    if (items.length === 0) {
      return;
    }

    try {
      const result = await bulkStatusMutation.mutateAsync({ items, status });
      const labels = Object.fromEntries(rows.map((row) => [row.id, row.woNumber || row.id]));
      const summary = summarizeBulkStatusResults(result.results ?? [], labels);
      if (summary.ok > 0) {
        toast.success(`Updated ${summary.ok} work order(s) to ${status.replaceAll("_", " ")}`);
      }
      if (summary.conflict > 0) {
        toast.error(`${summary.conflict} work order(s) changed elsewhere. The list was refreshed.`);
        void workOrdersQuery.refetch();
      }
      if (summary.error > 0) {
        toast.error(summary.lines.filter((line) => !line.includes("changed by someone else")).join(" ") || "Some work orders could not be updated.");
      }
      setSelectedIds(remainingBulkSelection(selectedIds, result.results ?? []));
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
        <Suspense fallback={<LoadingSkeleton />}>
          <WorkOrderQueuePanel
            jobDomain={jobDomain}
            onOpenWorkOrder={openEditModal}
            onRefreshLegacy={() => void workOrdersQuery.refetch()}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            onVisibleRows={setQueueStatusRows}
            technicians={technicians}
          />
        </Suspense>
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
            onMoveToStatus={(workOrder, status) => {
              if (!isAllowedKanbanDrop(workOrder.status, status)) {
                return;
              }

              void handleStatusChange(workOrder, status);
            }}
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
            actorRole={currentUser.role}
            onPrimary={(workOrder, actionId) => void handlePrimary(workOrder, actionId)}
          />
        )}
      </>
    );
  }, [
    handleAssign,
    handlePrimary,
    currentUser.role,
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
    toggleSort,
    technicians
  ]);

  const pageHeading = heading ?? "Work Orders";
  const pageDescription =
    description ?? "All executable maintenance jobs across machinery, service, and vehicle domains.";

  return (
    <div className="min-w-0 space-y-3">
      <PageBreadcrumbs className="mb-1" />
      <OperationalPageHeader
        title={pageHeading}
        description={pageDescription}
        actions={
        <div className="flex flex-wrap items-center gap-2">
          <JobsViewSwitcher view={view} onChange={setView} />
          {canCreateWorkOrders ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Plus size={16} aria-hidden /> Create Work Order
            </button>
          ) : null}
        </div>
        }
      />
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-700">{bulkCancelSummary(selectedIds.length, cancellableIds.length)}</span>
          <label>
            <span className="sr-only">Bulk status</span>
            <select
              disabled={bulkBusy}
              defaultValue=""
              onChange={(event) => {
                const status = event.target.value as WorkOrderStatus;
                if (!status) return;
                void handleBulkStatusChange(status);
                event.currentTarget.value = "";
              }}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
            >
              <option value="">Bulk status</option>
              {selectableWorkOrderStatuses(WORK_ORDER_STATUSES).map((status) => (
                <option key={status} value={status}>
                  {toTitleCase(status)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={bulkBusy || cancellableIds.length === 0}
            className="rounded-md border border-rose-300 px-2 py-1 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            Cancel open work orders
          </button>
        </div>
      ) : null}
      {view === "queues" ? null : (
      <WorkOrderFiltersBar
        filters={filters}
        technicians={technicians}
        view={view}
        selectionCount={selectedIds.length}
        bulkLoading={bulkBusy}
        canCreate={canCreateWorkOrders}
        showHeading={false}
        onChange={updateFilters}
        onReset={resetFilters}
        onCreate={openCreateModal}
        onViewChange={setView}
        onBulkStatusChange={(status) => void handleBulkStatusChange(status)}
        onBulkDelete={() => void handleBulkDelete()}
      />
      )}

      {view === "queues" ? null : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Work order counts">
          {(
            [
              ["Open", workOrdersQuery.stats.open, "text-slate-900"],
              ["In progress", workOrdersQuery.stats.inProgress, "text-slate-900"],
              ["Overdue", workOrdersQuery.stats.overdue, workOrdersQuery.stats.overdue > 0 ? "text-red-700" : "text-slate-900"],
              ["Completed", workOrdersQuery.stats.completed, "text-slate-900"]
            ] as Array<[string, number, string]>
          ).map(([label, value, tone]) => (
            <article key={label} className="rounded-card border border-slate-200 bg-white p-4 shadow-card">
              <p className="text-sm font-medium text-slate-600">{label}</p>
              <p className={`mt-3 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
            </article>
          ))}
        </div>
      )}

      <motion.section
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between px-1 text-sm text-slate-500">
          {view === "queues" ? (
            <span className="sr-only">Work order queue</span>
          ) : (
            <p>{totalFiltered} work order(s) shown</p>
          )}
          {workOrdersQuery.isFetching ? (
            <p className="inline-flex items-center gap-1 text-brand-700">
              <Loader2 size={14} className="animate-spin" /> Syncing...
            </p>
          ) : null}
        </div>

        {content}
      </motion.section>

      <WorkOrderEditorModal
        open={
          editorState.open &&
          (editorState.mode === "edit" || canCreateWorkOrders)
        }
        mode={editorState.mode}
        workOrder={editorState.workOrder}
        presetAssetId={editorState.presetAssetId}
        presetAssetLabel={editorState.presetAssetLabel}
        submitting={createMutation.isPending || updateMutation.isPending}
        createJobDomain={
          jobDomain === "MACHINERY" || jobDomain === "SERVICE" || jobDomain === "VEHICLE"
            ? jobDomain
            : undefined
        }
        initialTab={recordLink.tab}
        onClose={closeEditorModal}
        onCreate={(values) => {
          if (!canCreateWorkOrders) {
            toast.error("You do not have permission to create work orders.");
            return;
          }
          if (!currentUserId) {
            toast.error("Unable to identify current user. Please login again.");
            return;
          }

          if (createMutation.isPending) {
            return;
          }
          if (!createIdempotencyKey.current) {
            createIdempotencyKey.current = crypto.randomUUID();
          }

          createMutation
            .mutateAsync({
              ...values,
              createdById: currentUserId,
              idempotencyKey: createIdempotencyKey.current
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
          if (!editorState.workOrder || updateMutation.isPending) {
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
                // Technician completion → supervisor verification. Backend remaps
                // COMPLETED→TECHNICIAN_COMPLETED for tech roles; always send the
                // canonical tech-complete status so supervisors aren't stuck.
                status: "TECHNICIAN_COMPLETED",
                expectedVersion: completionTarget.version,
                delayReason: payload.delayReason,
                completionNote: payload.completionNote,
                failureCode: payload.failureCode,
                causeCode: payload.causeCode,
                remedyCode: payload.remedyCode,
                completionCondition: payload.completionCondition,
                followUpRequired: payload.followUpRequired,
                followUpNote: payload.followUpNote,
                functionalTestResult: payload.functionalTestResult,
                roadTestResult: payload.roadTestResult,
                completionMeterReading: payload.completionMeterReading,
                operatingRestriction: payload.operatingRestriction,
                productionImpact: payload.productionImpact
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

      <HoldWorkOrderModal
        open={Boolean(holdTarget)}
        workOrder={holdTarget}
        submitting={statusMutation.isPending}
        onClose={() => setHoldTarget(null)}
        onSubmit={(payload) => {
          if (!holdTarget) {
            return;
          }

          statusMutation
            .mutateAsync({
              id: holdTarget.id,
              payload: {
                status: "ON_HOLD",
                expectedVersion: holdTarget.version,
                delayReason: payload.delayReason
              }
            })
            .then(() => {
              toast.success(`${holdTarget.woNumber} placed on hold`);
              setHoldTarget(null);
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
