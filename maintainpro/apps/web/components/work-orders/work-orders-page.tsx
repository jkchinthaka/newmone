"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { ErrorState, LoadingCardSkeleton, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { usePromptDialog } from "@/components/ui/use-prompt-dialog";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { JobsViewSwitcher } from "@/components/operational/jobs-view-switcher";
import { RefreshErrorBanner } from "@/components/ui/refresh-error-banner";
import { clampPage, listErrorPresentation } from "@/lib/list-query-state";
import { colomboDateTimeToIso } from "@/lib/colombo-datetime";
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
import { approveThenAssign, verifyThenClose } from "@/lib/wo-flow-phase2";

import { CompleteWorkOrderModal } from "./complete-work-order-modal";
import { approveWorkOrder, assignWorkOrder } from "./api";
import { getErrorMessage, humanWorkOrderStatusLabel, toTitleCase } from "./helpers";
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
import type { WorkOrderDetailTab } from "./work-order-detail-tabs";
import {
  WORK_ORDER_STATUSES,
  type WorkOrder,
  type WorkOrderFilters,
  type WorkOrderSortField,
  type WorkOrderStatus,
  type WorkOrderViewMode
} from "./types";

function localInputToColomboIso(value: string): string {
  const [date, time] = value.split("T");
  return colomboDateTimeToIso(date ?? "", (time ?? "").slice(0, 5)) || new Date(value).toISOString();
}

function parseListPage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

const CANCEL_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"]);

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
      description="Fetching jobs, filters, and assignment data."
      title="Loading jobs"
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
  const { prompt, dialog: promptDialog } = usePromptDialog();
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
    detailTab?: WorkOrderDetailTab;
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
  const [approveAssignTarget, setApproveAssignTarget] = useState<WorkOrder | null>(null);
  const [approveAssignTech, setApproveAssignTech] = useState("");
  const [approveAssignStart, setApproveAssignStart] = useState("");
  const [approveAssignEnd, setApproveAssignEnd] = useState("");
  const [approveAssignSubmitting, setApproveAssignSubmitting] = useState(false);
  const createIdempotencyKey = useRef<string | null>(null);

  const { filters, updateFilters: patchFilters, resetFilters: resetStoredFilters } = useWorkOrderFilters();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // List/Board page lives in the URL (?listPage=) so refresh, back and shared links keep it.
  // A separate key from the queue view's ?page= so the two views do not fight over it.
  const listPage = parseListPage(searchParams.get("listPage"));
  const setListPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page > 1) params.set("listPage", String(page));
      else params.delete("listPage");
      const query = params.toString();
      router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const updateFilters = useCallback(
    (patch: Partial<WorkOrderFilters>) => {
      patchFilters(patch);
      if (listPage !== 1 && Object.keys(patch).some((key) => key !== "page")) setListPage(1);
    },
    [listPage, patchFilters, setListPage]
  );
  const resetFilters = useCallback(() => {
    resetStoredFilters();
    if (listPage !== 1) setListPage(1);
  }, [listPage, resetStoredFilters, setListPage]);
  const effectiveFilters = useMemo(
    () => ({ ...filters, page: listPage, ...(jobDomain ? { jobDomain } : {}) }),
    [filters, jobDomain, listPage]
  );
  // The queue view has its own server queries; do not fetch/poll the List/Board data behind it.
  const workOrdersQuery = useWorkOrders(effectiveFilters, { enabled: view !== "queues" });

  useEffect(() => {
    if (!workOrdersQuery.data || workOrdersQuery.isPlaceholderData) return;
    const clamped = clampPage(listPage, workOrdersQuery.pagination.total, workOrdersQuery.pagination.pageSize);
    if (clamped !== listPage) setListPage(clamped);
  }, [listPage, setListPage, workOrdersQuery.data, workOrdersQuery.isPlaceholderData, workOrdersQuery.pagination.pageSize, workOrdersQuery.pagination.total]);
  const recordLink = parseWorkOrderRecordLink({
    wo: searchParams.get("wo"),
    open: searchParams.get("open"),
    tab: searchParams.get("tab")
  });
  const deepLinkId = recordLink.id;
  const deepLinkQuery = useWorkOrder(deepLinkId ?? null);

  useEffect(() => {
    if (jobDomain && filters.jobDomain !== jobDomain) {
      patchFilters({ jobDomain });
    }
  }, [jobDomain, filters.jobDomain, patchFilters]);

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

  const openEditModal = (workOrder: WorkOrder, detailTab?: WorkOrderDetailTab) => {
    setEditorState({ open: true, mode: "edit", workOrder, detailTab });
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
      toast.error("That job could not be found or you don't have access to it.");
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
          : `Status updated to ${humanWorkOrderStatusLabel(status)}`
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // Same roles the API allows to cancel (SUPERVISOR_ROLE_NAMES). Others do not see the button.
  const canCancelWorkOrders = CANCEL_ROLES.has(currentUser.role ?? "");

  const handleDelete = async (workOrder: WorkOrder) => {
    const reason = await prompt({
      title: `Cancel ${workOrder.woNumber}?`,
      description: "The job is cancelled and its history is kept. It is not deleted.",
      label: "Reason for cancelling",
      required: true,
      validate: (value) => (value.trim().length < 3 ? "Enter at least 3 characters." : null),
      submitLabel: "Cancel job",
      cancelLabel: "Keep job"
    });
    if (!reason?.trim()) {
      return;
    }

    try {
      // The governed status change works from any open status; DELETE only allowed OPEN jobs for admins.
      await apiClient.patch(`/work-orders/${workOrder.id}/status`, {
        status: "CANCELLED",
        cancelReason: reason.trim(),
        expectedVersion: workOrder.version
      });
      toast.success(`${workOrder.woNumber} cancelled`);
      setSelectedIds((current) => current.filter((id) => id !== workOrder.id));
      await workOrdersQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };


  const handleAssign = async (workOrder: WorkOrder, technicianId: string) => {
    // Changing an existing technician needs a reason; ask before calling the API instead of failing.
    let reason: string | undefined;
    if (workOrder.technicianId && workOrder.technicianId !== technicianId) {
      const answer = await prompt({
        title: `Change technician on ${workOrder.woNumber}`,
        label: "Reason for the change",
        required: true,
        validate: (value) => (value.trim().length < 3 ? "Enter at least 3 characters." : null),
        submitLabel: "Change technician"
      });
      if (!answer?.trim()) return;
      reason = answer.trim();
    }
    try {
      await assignMutation.mutateAsync({ id: workOrder.id, technicianId, reason, expectedVersion: workOrder.version });
      toast.success("Technician assigned");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  /** Stores must confirm part returns before a job can close. Say so before verifying, with a way to the Parts tab. */
  const partsReturnsSettled = async (workOrder: WorkOrder) => {
    try {
      const response = await apiClient.get<{ data?: { pendingReturnLines?: number } }>(`/work-orders/${workOrder.id}/parts/summary`);
      const pending = response.data?.data?.pendingReturnLines ?? 0;
      if (pending > 0) {
        toast.error(`Waiting for stores to confirm ${pending} part return${pending === 1 ? "" : "s"}. Close the job after that.`, {
          action: { label: "Open Parts", onClick: () => openEditModal(workOrder, "parts") }
        });
        return false;
      }
    } catch {
      // If the summary cannot load, let the server decide.
    }
    return true;
  };

  const postClose = (workOrder: WorkOrder, expectedVersion: number | undefined, overrideReason?: string) =>
    apiClient.post(`/work-orders/${workOrder.id}/close`, {
      expectedVersion,
      note: "Closed after supervisor check",
      ...(overrideReason ? { overrideReason } : {})
    });

  /** High-priority jobs wait for the requester. Closing early needs a reason, so ask for one and retry. */
  const closeWithReasonIfNeeded = async (workOrder: WorkOrder, expectedVersion: number | undefined) => {
    try {
      await postClose(workOrder, expectedVersion);
      return true;
    } catch (error) {
      if (!/requester confirmation is still pending/i.test(getErrorMessage(error))) throw error;
      const reason = await prompt({
        title: `Close ${workOrder.woNumber} now`,
        description: "The requester has not confirmed the repair yet.",
        label: "Reason to close before confirmation",
        required: true,
        submitLabel: "Close job"
      });
      if (!reason?.trim()) throw new Error("Closing was cancelled.");
      await postClose(workOrder, expectedVersion, reason.trim());
      return true;
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
      const reason = await prompt({
        title: `Send ${workOrder.woNumber} back to be fixed again`,
        description: "The technician sees this on My jobs.",
        label: "What needs to be fixed?",
        required: true,
        validate: (value) => (value.trim().length < 3 ? "Enter at least 3 characters." : null),
        submitLabel: "Send back"
      });
      if (!reason?.trim()) return;
      try {
        await apiClient.post(`/work-orders/${workOrder.id}/reject-supervisor`, {
          reason: reason.trim()
        });
        toast.success(`${workOrder.woNumber} sent back`);
        await workOrdersQuery.refetch();
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
      return;
    }
    if (selected === "assign") {
      openEditModal(workOrder, "assignment");
      return;
    }
    if (selected === "approve-assign") {
      if (currentUser.id && workOrder.createdById === currentUser.id) {
        toast.message("You created this job. Another manager must approve it.");
        return;
      }
      setApproveAssignTarget(workOrder);
      setApproveAssignTech("");
      setApproveAssignStart("");
      setApproveAssignEnd("");
      return;
    }
    if (selected === "start" || selected === "resume") {
      await handleStatusChange(workOrder, "IN_PROGRESS");
      return;
    }
    if (selected === "complete") {
      setCompletionTarget(workOrder);
      return;
    }
    if ((selected === "close" || selected === "verify-close") && !(await partsReturnsSettled(workOrder))) {
      return;
    }
    if (selected === "close") {
      try {
        await closeWithReasonIfNeeded(workOrder, workOrder.version);
        toast.success(`${workOrder.woNumber} closed`);
      } catch (error) {
        toast.error(`${getErrorMessage(error)} The job stays verified.`);
      }
      await workOrdersQuery.refetch();
      return;
    }
    const result = await verifyThenClose({
      verify: () =>
        apiClient.post<{ data?: { version?: number } }>(`/work-orders/${workOrder.id}/verify-supervisor`, {
          expectedVersion: workOrder.version,
          verificationNote: "Verified from the job list"
        }),
      close: (verified) => closeWithReasonIfNeeded(workOrder, verified.data?.data?.version ?? workOrder.version)
    });
    if (!result.ok) {
      toast.error(
        result.stage === "close"
          ? `${getErrorMessage(result.error)} The job stays verified.`
          : getErrorMessage(result.error)
      );
      if (result.stage === "close") await workOrdersQuery.refetch();
      return;
    }
    toast.success(`${workOrder.woNumber} verified and closed`);
    await workOrdersQuery.refetch();
  };

  const submitApproveAssign = async () => {
    if (!approveAssignTarget || !approveAssignTech || !approveAssignStart || !approveAssignEnd) return;
    if (approveAssignSubmitting) return;
    const target = approveAssignTarget;
    // Disable the button on click, not after the response, so a slow network cannot double-submit.
    setApproveAssignSubmitting(true);
    const result = await approveThenAssign({
      approve: () => approveWorkOrder(target.id),
      assign: (approved) =>
        assignWorkOrder(target.id, approveAssignTech, {
          expectedVersion: approved.version,
          // datetime-local values are Asia/Colombo wall-clock times, not the device's zone.
          plannedStartAt: localInputToColomboIso(approveAssignStart),
          plannedEndAt: localInputToColomboIso(approveAssignEnd)
        })
    }).finally(() => setApproveAssignSubmitting(false));
    if (!result.ok) {
      toast.error(
        result.stage === "assign"
          ? `${getErrorMessage(result.error)} The job stays approved.`
          : getErrorMessage(result.error)
      );
      if (result.stage === "assign") {
        setApproveAssignTarget(null);
        await workOrdersQuery.refetch();
      }
      return;
    }
    toast.success(`${target.woNumber} approved and assigned`);
    setApproveAssignTarget(null);
    await workOrdersQuery.refetch();
  };

  const handleQueueAction = (workOrder: WorkOrder, actionId: string) => {
    if (actionId === "assign") {
      openEditModal(workOrder, "assignment");
      return;
    }
    void handlePrimary(workOrder, actionId);
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
      title: "Cancel open jobs?",
      description: "Only OPEN jobs will be cancelled. Records are kept for audit.",
      confirmLabel: "Cancel open jobs",
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
      toast.error("Bulk completion requires actual cost and hours per job.");
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
        toast.success(`Updated ${summary.ok} job(s) to ${humanWorkOrderStatusLabel(status)}`);
      }
      if (summary.conflict > 0) {
        toast.error(`${summary.conflict} job(s) changed elsewhere. The list was refreshed.`);
        void workOrdersQuery.refetch();
      }
      if (summary.error > 0) {
        toast.error(summary.lines.filter((line) => !line.includes("changed by someone else")).join(" ") || "Some jobs could not be updated.");
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
            onQueueAction={handleQueueAction}
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

    // A failed background refresh keeps the rows; only an error with nothing loaded replaces them.
    if (listErrorPresentation({ isError: workOrdersQuery.isError, hasData: Boolean(workOrdersQuery.data) }) === "full") {
      return (
        <ErrorState
          error={workOrdersQuery.error}
          onRetry={() => workOrdersQuery.refetch()}
          title="Could not load jobs"
          description={toSafeApiErrorMessage(
            workOrdersQuery.error,
            "Unable to load jobs right now."
          )}
        />
      );
    }

    return (
      <>
        {workOrdersQuery.isError ? (
          <RefreshErrorBanner onRetry={() => void workOrdersQuery.refetch()} retrying={workOrdersQuery.isFetching} />
        ) : null}
        <div className={workOrdersQuery.isPlaceholderData ? "opacity-60 transition-opacity" : undefined} aria-busy={workOrdersQuery.isPlaceholderData}>
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
            onDelete={canCancelWorkOrders ? (workOrder) => void handleDelete(workOrder) : undefined}
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
            onDelete={canCancelWorkOrders ? (workOrder) => void handleDelete(workOrder) : undefined}
            onEdit={openEditModal}
            actorRole={currentUser.role}
            currentUserId={currentUser.id}
            onPrimary={(workOrder, actionId) => void handlePrimary(workOrder, actionId)}
          />
        )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white">
          <JobsPagination
            page={workOrdersQuery.pagination.page}
            totalPages={workOrdersQuery.pagination.totalPages}
            total={workOrdersQuery.pagination.total}
            pageSize={filters.pageSize}
            onPageChange={setListPage}
            onPageSizeChange={(pageSize) => updateFilters({ pageSize })}
          />
        </div>
      </>
    );
  }, [
    handleAssign,
    handlePrimary,
    handleQueueAction,
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

  const pageHeading = heading ?? "Jobs";
  const pageDescription =
    description ?? "All maintenance jobs across machinery, vehicles and services.";

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
              <Plus size={16} aria-hidden /> Create job
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
            Cancel open jobs
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Job counts">
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
            <span className="sr-only">Job queue</span>
          ) : (
            <p>
              {totalFiltered} of {workOrdersQuery.pagination.total} work order(s) shown
            </p>
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
        initialTab={editorState.detailTab ?? recordLink.tab}
        actorRole={currentUser.role}
        onPrimaryAction={(workOrder, actionId) => {
          // Assign stays in this drawer (assignment tab). Other steps open their own dialog, so close the drawer first.
          if (actionId !== "assign") closeEditorModal();
          handleQueueAction(workOrder, actionId);
        }}
        onClose={closeEditorModal}
        onCreate={(values) => {
          if (!canCreateWorkOrders) {
            toast.error("You do not have permission to create jobs.");
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
              toast.success("Job created");
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
              toast.success("Job updated");
              closeEditorModal();
            })
            .catch((error) => {
              toast.error(getErrorMessage(error));
            });
        }}
      />

      {approveAssignTarget ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/30 p-4">
          <form
            role="dialog"
            aria-label="Approve and assign"
            className="w-full max-w-md rounded-card border border-slate-200 bg-white p-4 shadow-card"
            onSubmit={(event) => {
              event.preventDefault();
              void submitApproveAssign();
            }}
          >
            <h2 className="text-lg font-semibold">Approve & assign</h2>
            <p className="mt-1 text-sm text-slate-600">{approveAssignTarget.woNumber}</p>
            <label className="mt-3 block text-sm">
              Technician
              <select required className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" value={approveAssignTech} onChange={(event) => setApproveAssignTech(event.target.value)}>
                <option value="">Select a technician</option>
                {technicians.map((technician) => (
                  <option key={technician.id} value={technician.id}>{technician.fullName}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              Planned start
              <input required type="datetime-local" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" value={approveAssignStart} onChange={(event) => setApproveAssignStart(event.target.value)} />
            </label>
            <label className="mt-3 block text-sm">
              Planned end
              <input required type="datetime-local" className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2" value={approveAssignEnd} onChange={(event) => setApproveAssignEnd(event.target.value)} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="min-h-10 rounded-md border border-slate-300 px-3 text-sm" onClick={() => setApproveAssignTarget(null)}>Cancel</button>
              <button type="submit" disabled={approveAssignSubmitting} aria-busy={approveAssignSubmitting} className="min-h-11 rounded-md bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-60">
                {approveAssignSubmitting ? "Saving…" : "Approve & assign"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <CompleteWorkOrderModal
        open={Boolean(completionTarget)}
        workOrder={completionTarget}
        submitting={statusMutation.isPending}
        onClose={() => setCompletionTarget(null)}
        onOpenTab={(tab) => {
          const target = completionTarget;
          setCompletionTarget(null);
          if (target) openEditModal(target, tab);
        }}
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
              toast.success("Job submitted for supervisor check");
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
            <p className="mt-1 text-sm text-slate-600">Provide a reason for rejection. This cancels the job.</p>
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
                Reject job
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {busy ? <div className="fixed bottom-4 right-4 rounded-full bg-slate-900 px-3 py-1 text-xs text-white">Processing...</div> : null}
      {confirmDialog}
      {promptDialog}
    </div>
  );
}
