"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Loader2, MoreHorizontal, X, AlertTriangle } from "lucide-react";

import { DateField } from "@/components/forms/date-fields";
import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { EXPECTED_COMPLETION_AFTER_DUE } from "@maintainpro/shared-types";
import { visibleWorkOrderTab, workOrderTabLoads } from "@/lib/operational-deep-link";
import { dialogTabTrapDecision, workOrderDrawerEscapeDecision } from "@/lib/overlay-dismiss";
import { disableSubmitControl } from "@/lib/submit-lock";
import { canViewAuditHistoryForUser, useCurrentUser } from "@/lib/use-current-user";
import { canVerifyWorkOrder, isWorkOrderStarted } from "@/lib/work-order-governance";
import { queueNextControl } from "@/lib/batch-3-presentation";
import { isWorkOrderDrawerReadOnly } from "@/lib/work-order-drawer-display";
import { overviewDraftDirty, overviewSaveDecision, type OverviewDraft } from "@/lib/work-order-overview-edit";
import type { WorkOrderActivityTimelineResponse } from "@/lib/work-order-activity";
import { workOrderActivityUnavailableMessage } from "@/lib/work-order-activity";
import type {
  EvidenceStorageReadiness,
  WorkOrderEvidenceItem,
  WorkOrderEvidenceRequirements
} from "@/lib/work-order-evidence";

import { asDateInputValue, requiresAssetOrVehicle, toTitleCase } from "./helpers";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_TYPES, type UpdateWorkOrderInput, type WorkOrder } from "./types";
import { PartRequestsPanel } from "./part-requests-panel";
import { WorkOrderAssigneesPanel } from "./work-order-assignees-panel";
import { WorkOrderAuditPanel } from "./work-order-audit-panel";
import { WorkOrderDetailTabs, type WorkOrderDetailTab } from "./work-order-detail-tabs";
import { WorkOrderEvidencePanel } from "./work-order-evidence-panel";
import { WorkOrderGovernanceBanner } from "./work-order-governance-banner";
import { WorkOrderDomainPanel } from "./work-order-domain-panel";
import { SupervisorVerificationPanel } from "./supervisor-verification-panel";
import { WorkOrderVendorRepairPanel } from "./work-order-vendor-repair-panel";
import { WorkOrderGuidedCreate } from "./work-order-guided-create";
import { useWorkOrderHistorySummary, WorkOrderHistoryPanel } from "./work-order-history-panel";
import { WorkOrderSafetyPanel } from "./work-order-safety-panel";
import {
  DrawerStatusRow,
  drawerTitle,
  WorkOrderLockBanner,
  WorkOrderOverviewView,
  WorkOrderProgress
} from "./work-order-drawer-chrome";
import { WorkOrderSlaHeader } from "./work-order-insights";

type WorkOrderEditorMode = "create" | "edit";

type WorkOrderCreateFormValue = {
  title: string;
  description: string;
  priority: (typeof WORK_ORDER_PRIORITIES)[number];
  type: (typeof WORK_ORDER_TYPES)[number];
  dueDate?: string;
  expectedCompletionDate?: string;
  assetId?: string;
  vehicleId?: string;
  functionalLocationId?: string;
  scheduleId?: string;
  taxonomyCategoryId?: string;
  taxonomyTypeId?: string;
  taxonomyIssueId?: string;
  isTriage?: boolean;
  triageReason?: string;
  jobDomain?: string;
  currentOdometer?: number;
  jobCategoryId?: string;
};

type WorkOrderEditFormValue = UpdateWorkOrderInput;

type WorkOrderEditorModalProps = {
  open: boolean;
  mode: WorkOrderEditorMode;
  workOrder?: WorkOrder | null;
  submitting: boolean;
  /** When set (domain job lanes), create form locks that jobDomain. */
  createJobDomain?: "MACHINERY" | "SERVICE" | "VEHICLE";
  initialTab?: WorkOrderDetailTab;
  presetAssetId?: string | null;
  presetAssetLabel?: string | null;
  onClose: () => void;
  onCreate: (values: WorkOrderCreateFormValue) => void;
  onEdit: (values: WorkOrderEditFormValue) => void;
  /** Role of the signed-in user. With onPrimaryAction it shows the next lifecycle step in the footer. */
  actorRole?: string | null;
  /** Runs the same next step as the list row button (Assign technician, Start job, Mark complete, Verify & close). */
  onPrimaryAction?: (workOrder: WorkOrder, actionId: string) => void;
};

export function WorkOrderEditorModal({
  open,
  mode,
  workOrder,
  submitting,
  createJobDomain,
  initialTab,
  presetAssetId,
  presetAssetLabel,
  onClose,
  onCreate,
  onEdit,
  actorRole,
  onPrimaryAction
}: WorkOrderEditorModalProps) {
  const isCreateMode = mode === "create";
  const reduceMotion = useReducedMotion();
  const drawerMotion = reduceMotion ? { duration: 0 } : { duration: 0.18 };

  const initialState = useMemo(
    () => ({
      title: workOrder?.title ?? "",
      description: workOrder?.description ?? "",
      priority: workOrder?.priority ?? "MEDIUM",
      type: workOrder?.type ?? "CORRECTIVE",
      dueDate: asDateInputValue(workOrder?.dueDate),
      expectedCompletionDate: asDateInputValue(workOrder?.expectedCompletionDate ?? workOrder?.dueDate),
      assetId: workOrder?.assetId || presetAssetId || "",
      vehicleId: workOrder?.vehicleId ?? "",
      scheduleId: workOrder?.scheduleId ?? "",
      estimatedCost: workOrder?.estimatedCost?.toString() ?? "",
      estimatedHours: workOrder?.estimatedHours?.toString() ?? ""
    }),
    [presetAssetId, workOrder]
  );

  const currentUser = useCurrentUser();
  const showAuditTab = canViewAuditHistoryForUser(currentUser);
  const [formState, setFormState] = useState(initialState);
  const [editingOverview, setEditingOverview] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const sectionCache = useRef({ id: "", requirements: false, evidence: false, activity: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkOrderDetailTab>(() => visibleWorkOrderTab(initialTab, showAuditTab));
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityTimeline, setActivityTimeline] = useState<WorkOrderActivityTimelineResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceReadiness, setEvidenceReadiness] = useState<EvidenceStorageReadiness | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<WorkOrderEvidenceItem[]>([]);
  const [evidenceRequirements, setEvidenceRequirements] = useState<WorkOrderEvidenceRequirements | null>(null);
  const historySummary = useWorkOrderHistorySummary(!isCreateMode ? workOrder?.id : undefined);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(initialState);
    setEditingOverview(false);
    setFormError(null);
    setActiveTab(visibleWorkOrderTab(initialTab, showAuditTab));
  }, [initialState, initialTab, open, showAuditTab]);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const previous = returnFocusRef.current;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const nestedOverlayOpen = Array.from(document.querySelectorAll("[role='dialog'], [role='alertdialog']")).some(
        (node) => node !== panelRef.current && !panelRef.current?.contains(node)
      );
      if (event.key === "Tab" && !nestedOverlayOpen && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((node) => !node.hasAttribute("disabled") && node.getClientRects().length > 0);
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const decision = dialogTabTrapDecision({
          key: event.key,
          shiftKey: event.shiftKey,
          activeInside: Boolean(active && panelRef.current.contains(active)),
          activeIsFirst: active === focusable[0],
          activeIsLast: active === focusable[focusable.length - 1],
          focusableCount: focusable.length
        });
        if (decision === "focus-first") {
          event.preventDefault();
          focusable[0]?.focus();
          return;
        }
        if (decision === "focus-last") {
          event.preventDefault();
          focusable[focusable.length - 1]?.focus();
          return;
        }
      }
      const decision = workOrderDrawerEscapeDecision({
        key: event.key,
        defaultPrevented: event.defaultPrevented,
        submitting,
        menuOpen,
        nestedOverlayOpen
      });
      if (decision === "ignore") return;
      event.preventDefault();
      if (decision === "close-menu") {
        setMenuOpen(false);
        return;
      }
      if (editingOverview) {
        setEditingOverview(false);
        setFormState(initialState);
        setFormError(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editingOverview, initialState, menuOpen, onClose, open, submitting]);

  useEffect(() => {
    if (!open) return;
    const selected = panelRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    (selected ?? panelRef.current)?.focus();
  }, [open, activeTab, workOrder?.id]);

  useEffect(() => {
    if (!open || isCreateMode || !workOrder?.id) {
      sectionCache.current = { id: "", requirements: false, evidence: false, activity: false };
      setActivityTimeline(null);
      setActivityError(null);
      setActivityLoading(false);
      setEvidenceItems([]);
      setEvidenceRequirements(null);
      setEvidenceReadiness(null);
      setEvidenceLoading(false);
      return;
    }

    let cancelled = false;

    const applyEvidencePayload = (
      evidenceData:
        | { items?: WorkOrderEvidenceItem[]; requirements?: WorkOrderEvidenceRequirements }
        | undefined
    ) => {
      setEvidenceItems(evidenceData?.items ?? []);
      setEvidenceRequirements(evidenceData?.requirements ?? null);
    };

    const loadRequirements = async () => {
      try {
        const evidenceResponse = await apiClient.get(`/work-orders/${workOrder.id}/evidence`);
        if (!cancelled) {
          const evidenceData = evidenceResponse.data?.data as
            | { requirements?: WorkOrderEvidenceRequirements }
            | undefined;
          setEvidenceRequirements(evidenceData?.requirements ?? null);
          sectionCache.current.requirements = true;
        }
      } catch {
        if (!cancelled) setEvidenceRequirements(null);
      }
    };

    const loadEvidence = async () => {
      setEvidenceLoading(true);
      try {
        const [readinessResponse, evidenceResponse] = await Promise.all([
          apiClient.get("/evidence/readiness"),
          apiClient.get(`/work-orders/${workOrder.id}/evidence`)
        ]);
        if (!cancelled) {
          setEvidenceReadiness(readinessResponse.data?.data as EvidenceStorageReadiness);
          applyEvidencePayload(
            evidenceResponse.data?.data as
              | { items?: WorkOrderEvidenceItem[]; requirements?: WorkOrderEvidenceRequirements }
              | undefined
          );
          sectionCache.current.evidence = true;
          sectionCache.current.requirements = true;
        }
      } catch {
        if (!cancelled) {
          setEvidenceReadiness(null);
          setEvidenceItems([]);
        }
      } finally {
        if (!cancelled) {
          setEvidenceLoading(false);
        }
      }
    };

    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);

      try {
        const response = await apiClient.get(`/work-orders/${workOrder.id}/activity`);
        const payload = response.data?.data as WorkOrderActivityTimelineResponse | undefined;

        if (!cancelled) {
          setActivityTimeline(payload ?? null);
          sectionCache.current.activity = true;
        }
      } catch (error) {
        if (!cancelled) {
          setActivityTimeline(null);
          setActivityError(getApiErrorMessage(error, workOrderActivityUnavailableMessage()));
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    };

    if (sectionCache.current.id !== workOrder.id) {
      sectionCache.current = { id: workOrder.id, requirements: false, evidence: false, activity: false };
    }
    const loads = workOrderTabLoads(activeTab);
    if (loads.activity && !sectionCache.current.activity) void loadActivity();
    if (loads.evidence && !sectionCache.current.evidence) void loadEvidence();
    else if (loads.requirements && !sectionCache.current.requirements) void loadRequirements();

    return () => {
      cancelled = true;
    };
  }, [open, isCreateMode, workOrder?.id, activeTab]);

  const assetRequired = isCreateMode && requiresAssetOrVehicle(formState.type);
  const overviewEditable = isCreateMode || editingOverview;
  const scheduleLocked = !isCreateMode && Boolean(workOrder && isWorkOrderStarted(workOrder.status));
  const overviewBaseline: OverviewDraft = {
    title: initialState.title,
    description: initialState.description,
    dueDate: initialState.dueDate ?? "",
    expectedCompletionDate: initialState.expectedCompletionDate ?? "",
    estimatedCost: initialState.estimatedCost ?? "",
    estimatedHours: initialState.estimatedHours ?? ""
  };
  const overviewDirty = overviewDraftDirty(
    {
      title: formState.title,
      description: formState.description,
      dueDate: formState.dueDate ?? "",
      expectedCompletionDate: formState.expectedCompletionDate ?? "",
      estimatedCost: formState.estimatedCost ?? "",
      estimatedHours: formState.estimatedHours ?? ""
    },
    overviewBaseline
  );
  const drawerReadOnly = !isCreateMode && Boolean(workOrder && isWorkOrderDrawerReadOnly(workOrder.status));
  const saveDecision = overviewSaveDecision({
    mode: isCreateMode ? "create" : editingOverview ? "edit" : "view",
    tab: activeTab,
    dirty: overviewDirty,
    title: formState.title,
    description: formState.description,
    submitting
  });

  function cancelOverviewEdit() {
    setEditingOverview(false);
    setFormState(initialState);
    setFormError(null);
  }

  function requestClose() {
    if (editingOverview && overviewDirty) {
      setActiveTab("overview");
      setFormError("Save or cancel the overview changes before closing.");
      return;
    }
    onClose();
  }

  const drawer = (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={drawerMotion}
          className="fixed inset-0 z-[80] flex justify-end bg-[#104D2B]/45"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="work-order-editor-title"
            tabIndex={-1}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={drawerMotion}
            className="flex h-dvh w-full max-w-full flex-col overflow-hidden bg-white shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 sm:max-w-[760px]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-brand-800">
                  {isCreateMode ? "New job" : workOrder?.woNumber || "Job"}
                </p>
                <h3 id="work-order-editor-title" className="page-title break-words">
                  {isCreateMode ? "Create an open job" : workOrder ? drawerTitle(workOrder) : "Job"}
                </h3>
                {!isCreateMode && workOrder ? (
                  <>
                    <DrawerStatusRow workOrder={workOrder} />
                    <WorkOrderSlaHeader workOrderId={workOrder.id} />
                    <WorkOrderProgress status={workOrder.status} />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-brand-800">Planning can continue after creation.</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!isCreateMode && saveDecision.showSave ? (
                  <button
                    type="submit"
                    form="work-order-editor-form"
                    disabled={!saveDecision.enabled}
                    className="btn-primary !hidden min-h-10 justify-center disabled:opacity-70 sm:!inline-flex"
                    aria-describedby={saveDecision.reason ? "overview-save-reason" : undefined}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {saveDecision.label}
                  </button>
                ) : null}
                {!isCreateMode ? (
                  <div className="relative">
                    <button
                      type="button"
                      className="btn-quiet h-10 px-2"
                      aria-label="More actions"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((openMenu) => !openMenu)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen ? (
                      <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-brand-100 bg-white p-1 shadow-sm">
                        {(
                          [
                            ["history", "Open history"],
                            ["evidence", "Open photos"],
                            ...(currentUser.role === "TECHNICIAN" || currentUser.role === "MECHANIC"
                              ? []
                              : ([["assignment", "Open assignment"]] as const))
                          ] as const
                        ).map(([tab, label]) => (
                          <button
                            key={tab}
                            type="button"
                            role="menuitem"
                            className="block w-full rounded-md px-2 py-2 text-left text-sm text-ink hover:bg-brand-50"
                            onClick={() => {
                              setActiveTab(tab);
                              setMenuOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={requestClose}
                  className="btn-quiet h-10 px-2"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {!isCreateMode && workOrder ? <WorkOrderLockBanner status={workOrder.status} /> : null}

            {!isCreateMode && workOrder?.id ? (
              <WorkOrderDetailTabs
                activeTab={activeTab}
                onChange={setActiveTab}
                showAudit={showAuditTab}
                showAssignment={currentUser.role !== "TECHNICIAN" && currentUser.role !== "MECHANIC"}
                counts={{
                  evidence: evidenceItems.some((item) => item.status === "UPLOADED")
                    ? evidenceItems.filter((item) => item.status === "UPLOADED").length
                    : undefined,
                  history:
                    historySummary.data &&
                    historySummary.data.previousMaintenance.length + historySummary.data.previousBreakdowns.length > 0
                      ? historySummary.data.previousMaintenance.length + historySummary.data.previousBreakdowns.length
                      : undefined
                }}
              />
            ) : null}

            {isCreateMode ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <WorkOrderGuidedCreate
                  submitting={submitting}
                  jobDomain={createJobDomain}
                  initialAssetId={presetAssetId}
                  initialAssetLabel={presetAssetLabel}
                  onCancel={onClose}
                  onSubmit={(values) => {
                    if (!values.description.trim() || submitting) {
                      return;
                    }

                    onCreate({
                      title: values.title,
                      description: values.description,
                      priority: values.priority,
                      type: values.type,
                      dueDate: values.dueDate
                        ? new Date(`${values.dueDate}T00:00:00.000Z`).toISOString()
                        : undefined,
                      expectedCompletionDate: values.expectedCompletionDate
                        ? new Date(`${values.expectedCompletionDate}T00:00:00.000Z`).toISOString()
                        : undefined,
                      assetId: values.assetId,
                      vehicleId: values.vehicleId,
                      functionalLocationId: values.functionalLocationId,
                      jobDomain: values.jobDomain,
                      jobCategoryId: values.jobCategoryId,
                      currentOdometer: values.currentOdometer
                    });
                  }}
                />
              </div>
            ) : (
              <form
              id="work-order-editor-form"
              onSubmit={(event) => {
                event.preventDefault();
                disableSubmitControl(event.currentTarget);

                const release = () => {
                  const button = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
                  if (button) button.disabled = false;
                };
                if (submitting || !formState.title.trim() || !formState.description.trim() || !editingOverview) {
                  release();
                  return;
                }

                const scheduleLocked = Boolean(workOrder && isWorkOrderStarted(workOrder.status));

                if (isCreateMode) {
                  release();
                  return;
                }

                if (formState.dueDate && formState.expectedCompletionDate) {
                  const due = new Date(`${formState.dueDate}T00:00:00.000Z`);
                  const expected = new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`);
                  if (due.getTime() < expected.getTime()) {
                    setFormError(EXPECTED_COMPLETION_AFTER_DUE);
                    release();
                    return;
                  }
                }
                if (formState.estimatedCost.trim() !== "") {
                  const cost = Number(formState.estimatedCost);
                  if (!Number.isFinite(cost) || cost < 0) {
                    setFormError("Estimated cost cannot be negative.");
                    release();
                    return;
                  }
                }
                if (formState.estimatedHours.trim() !== "") {
                  const hours = Number(formState.estimatedHours);
                  if (!Number.isFinite(hours) || hours <= 0) {
                    setFormError("Estimated hours must be greater than 0.");
                    release();
                    return;
                  }
                }

                setFormError(null);
                onEdit({
                  title: formState.title.trim(),
                  description: formState.description.trim(),
                  dueDate:
                    scheduleLocked || !formState.dueDate
                      ? undefined
                      : new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString(),
                  expectedCompletionDate:
                    scheduleLocked || !formState.expectedCompletionDate
                      ? undefined
                      : new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`).toISOString(),
                  estimatedCost:
                    formState.estimatedCost.trim() === ""
                      ? undefined
                      : Number(formState.estimatedCost),
                  estimatedHours:
                    formState.estimatedHours.trim() === ""
                      ? undefined
                      : Number(formState.estimatedHours)
                });
              }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4">
              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {formError}
                </p>
              ) : null}
              {!isCreateMode && activeTab !== "overview" ? null : !editingOverview && workOrder ? (
                <WorkOrderOverviewView
                  workOrder={workOrder}
                  description={formState.description}
                  role={currentUser.role}
                  readOnly={drawerReadOnly}
                  onEdit={() => setEditingOverview(true)}
                />
              ) : (
              <section className="space-y-4 rounded-xl border border-brand-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-ink">Details</h4>
                {!isCreateMode && activeTab === "overview" && !editingOverview ? (
                  <button type="button" className="btn-quiet" onClick={() => setEditingOverview(true)}>
                    Edit details
                  </button>
                ) : null}
                </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Title</span>
                  <input
                    required
                    readOnly={!overviewEditable}
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="field w-full"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Description</span>
                  <textarea
                    required
                    readOnly={!overviewEditable}
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    className="field field-multiline w-full"
                  />
                </label>

                {isCreateMode ? (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Priority</span>
                      <select
                        value={formState.priority}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            priority: event.target.value as WorkOrderCreateFormValue["priority"]
                          }))
                        }
                        className="field w-full"
                      >
                        {WORK_ORDER_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {toTitleCase(priority)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Type</span>
                      <select
                        value={formState.type}
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            type: event.target.value as WorkOrderCreateFormValue["type"]
                          }))
                        }
                        className="field w-full"
                      >
                        {WORK_ORDER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {toTitleCase(type)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Estimated Cost</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formState.estimatedCost}
                        readOnly={!overviewEditable}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, estimatedCost: event.target.value }))
                        }
                        className="field w-full"
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Estimated Hours</span>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={formState.estimatedHours}
                        readOnly={!overviewEditable}
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, estimatedHours: event.target.value }))
                        }
                        className="field w-full"
                      />
                    </label>
                  </>
                )}

                <label className="min-w-0 space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Due Date</span>
                  <DateField
                    bare
                    label="Due Date"
                    value={formState.dueDate}
                    disabled={!overviewEditable || scheduleLocked}
                    describedBy={scheduleLocked ? "overview-date-lock" : undefined}
                    onChange={(dueDate) => setFormState((current) => ({ ...current, dueDate }))}
                  />
                </label>

                <label className="min-w-0 space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Expected completion (requester)</span>
                  <DateField
                    bare
                    label="Expected completion (requester)"
                    value={formState.expectedCompletionDate}
                    disabled={!overviewEditable || scheduleLocked}
                    describedBy={scheduleLocked ? "overview-date-lock" : undefined}
                    onChange={(expectedCompletionDate) =>
                      setFormState((current) => ({ ...current, expectedCompletionDate }))
                    }
                  />
                </label>
                {workOrder?.status === "CANCELLED" ? (
                  <p className="text-sm text-slate-700 sm:col-span-2">
                    This job is cancelled. Its approval record stays as history. This screen does not reopen it or change that approval.
                  </p>
                ) : null}
                {scheduleLocked ? (
                  <p id="overview-date-lock" className="text-sm text-slate-600 sm:col-span-2">
                    Due date and expected completion stay locked after work starts. Title, description, estimated cost, and estimated hours can still be edited.
                  </p>
                ) : null}

                {isCreateMode ? (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">
                        Asset {assetRequired ? "(required for this type — or link a vehicle)" : "(optional)"}
                      </span>
                    <p className="text-sm text-brand-800">
                        General CORRECTIVE/EMERGENCY tasks may omit asset and vehicle. PREVENTIVE, INSPECTION, and
                        INSTALLATION require at least one link.
                      </p>
                      <EntityPicker
                        endpoint="/assets"
                        searchParam="search"
                        pageSizeParam="limit"
                        pageSize={20}
                        value={formState.assetId || null}
                        displayField="assetTag"
                        secondaryField="name"
                        placeholder="Search assets by tag or name..."
                        onChange={(id) =>
                          setFormState((current) => ({ ...current, assetId: id ?? "" }))
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">Vehicle (optional)</span>
                      <EntityPicker
                        endpoint="/vehicles"
                        value={formState.vehicleId || null}
                        displayField="registrationNo"
                        secondaryField="vehicleModel"
                        placeholder="Search vehicles by registration or model..."
                        onChange={(id) =>
                          setFormState((current) => ({ ...current, vehicleId: id ?? "" }))
                        }
                      />
                    </label>

                    <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                      <span className="font-medium">Schedule ID (optional)</span>
                      <input
                        value={formState.scheduleId}
                        onChange={(event) => setFormState((current) => ({ ...current, scheduleId: event.target.value }))}
                        className="field w-full"
                      />
                    </label>
                  </>
                ) : null}
              </div>
              </section>
              )}

              {!isCreateMode && workOrder && activeTab === "overview" ? (
                <div className="space-y-3">
                  <WorkOrderGovernanceBanner workOrder={workOrder} />
                  <WorkOrderDomainPanel
                    workOrderId={workOrder.id}
                    workOrderStatus={workOrder.status}
                    canReturnToService={Boolean(
                      currentUser.role &&
                        [
                          "SUPER_ADMIN",
                          "ADMIN",
                          "MANAGER",
                          "OPERATIONS_MANAGER",
                          "ASSET_MANAGER",
                          "SUPERVISOR",
                          "FLEET_MANAGER"
                        ].includes(String(currentUser.role))
                    )}
                  />
                  {canVerifyWorkOrder({ role: currentUser.role, permissions: currentUser.permissions }) &&
                  typeof workOrder.version === "number" ? (
                    <SupervisorVerificationPanel
                      workOrderId={workOrder.id}
                      status={workOrder.status}
                      expectedVersion={workOrder.version}
                      evidenceRequirements={evidenceRequirements}
                      canRequestRework={currentUser.role !== "SUPERVISOR"}
                      onUpdated={onClose}
                    />
                  ) : null}
                </div>
              ) : null}

              {!isCreateMode && activeTab === "overview" && historySummary.data?.repeatIssueWarnings?.length ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold">Repeated issue detected for this asset/vehicle.</p>
                      <p className="mt-1 text-sm">Open the History tab for prior maintenance context.</p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "assignment" ? (
                <WorkOrderAssigneesPanel
                  workOrderId={workOrder.id}
                  readOnly={drawerReadOnly}
                  actualHours={workOrder.actualHours}
                />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "parts" ? (
                <PartRequestsPanel workOrderId={workOrder.id} readOnly={drawerReadOnly} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "safety" ? (
                <WorkOrderSafetyPanel workOrderId={workOrder.id} readOnly={drawerReadOnly} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "evidence" ? (
                <div className="space-y-4">
                  <WorkOrderEvidencePanel
                    workOrderId={workOrder.id}
                    readOnly={drawerReadOnly}
                    readiness={evidenceReadiness}
                    items={evidenceItems}
                    requirements={evidenceRequirements}
                    assetId={workOrder.assetId}
                    vehicleId={workOrder.vehicleId}
                    loading={evidenceLoading}
                    onRefresh={async () => {
                      const evidenceResponse = await apiClient.get(`/work-orders/${workOrder.id}/evidence`);
                      const evidenceData = evidenceResponse.data?.data as
                        | { items?: WorkOrderEvidenceItem[]; requirements?: WorkOrderEvidenceRequirements }
                        | undefined;
                      setEvidenceItems(evidenceData?.items ?? []);
                      setEvidenceRequirements(evidenceData?.requirements ?? null);
                    }}
                  />
                </div>
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "vendor-repair" ? (
                <WorkOrderVendorRepairPanel
                  workOrderId={workOrder.id}
                  verificationStatus={workOrder.verificationStatus ?? undefined}
                  readOnly={drawerReadOnly}
                />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "history" ? (
                <WorkOrderHistoryPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "audit" && showAuditTab ? (
                <WorkOrderAuditPanel workOrderId={workOrder.id} />
              ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2 border-t border-brand-100 bg-white px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {saveDecision.reason ? (
                  <p id="overview-save-reason" className="text-sm text-slate-700 sm:mr-auto" role="status">{saveDecision.reason}</p>
                ) : null}
                {editingOverview ? (
                  <button type="button" onClick={cancelOverviewEdit} className="btn-quiet w-full justify-center sm:w-auto">
                    Cancel
                  </button>
                ) : (
                  <button type="button" onClick={requestClose} className="btn-quiet w-full justify-center sm:w-auto">
                    Close
                  </button>
                )}
                {!isCreateMode && !editingOverview && workOrder && onPrimaryAction
                  ? (() => {
                      const next = queueNextControl({
                        status: workOrder.status,
                        role: actorRole,
                        approvalStatus: workOrder.approvalStatus
                      });
                      return next.kind === "action" ? (
                        <button
                          type="button"
                          onClick={() => onPrimaryAction(workOrder, next.actionId)}
                          className="btn-primary w-full justify-center sm:w-auto"
                        >
                          {next.label}
                        </button>
                      ) : null;
                    })()
                  : null}
                {saveDecision.showSave ? (
                  <button
                    type="submit"
                    disabled={!saveDecision.enabled}
                    className="btn-primary w-full justify-center disabled:opacity-70 sm:!hidden"
                    aria-describedby={saveDecision.reason ? "overview-save-reason" : undefined}
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    {saveDecision.label}
                  </button>
                ) : null}
              </div>
            </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(drawer, document.body);
}
