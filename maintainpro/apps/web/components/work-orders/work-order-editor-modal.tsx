"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MoreHorizontal, X, AlertTriangle } from "lucide-react";

import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { visibleWorkOrderTab, workOrderTabLoads } from "@/lib/operational-deep-link";
import { canViewAuditHistoryForUser, useCurrentUser } from "@/lib/use-current-user";
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
import { WorkOrderActivityPanel } from "./work-order-activity-panel";
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
  onEdit
}: WorkOrderEditorModalProps) {
  const isCreateMode = mode === "create";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkOrderDetailTab>(() => visibleWorkOrderTab(initialTab, showAuditTab));
  const panelRef = useRef<HTMLDivElement>(null);
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
    setFormError(null);
    setActiveTab(visibleWorkOrderTab(initialTab, showAuditTab));
  }, [initialState, initialTab, open, showAuditTab]);

  useEffect(() => {
    if (!open) return;
    const selected = panelRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    (selected ?? panelRef.current)?.focus();
  }, [open, activeTab, workOrder?.id]);

  useEffect(() => {
    if (!open || isCreateMode || !workOrder?.id) {
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

    const loads = workOrderTabLoads(activeTab);
    if (loads.activity) void loadActivity();
    if (loads.evidence) void loadEvidence();
    else if (loads.requirements) void loadRequirements();

    return () => {
      cancelled = true;
    };
  }, [open, isCreateMode, workOrder?.id, activeTab]);

  const assetRequired = isCreateMode && requiresAssetOrVehicle(formState.type);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex justify-end bg-[#104D2B]/45"
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
            transition={{ duration: 0.18 }}
            className="flex h-[100dvh] w-full max-w-4xl flex-col bg-white shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-800">
                  {isCreateMode ? "New work order" : workOrder?.woNumber || "Work order"}
                </p>
                <h3 id="work-order-editor-title" className="page-title truncate">
                  {isCreateMode ? "Create an open job" : workOrder?.title || "Work order"}
                </h3>
                {!isCreateMode && workOrder ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink">
                    <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-medium">
                      {toTitleCase(workOrder.status)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-medium ${
                        workOrder.priority === "CRITICAL" || workOrder.priority === "HIGH"
                          ? "border-amber-300 bg-accent-50 text-accent-700"
                          : "border-brand-100 bg-white"
                      }`}
                    >
                      {toTitleCase(workOrder.priority)}
                    </span>
                    {workOrder.slaBreached ? (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 font-medium text-rose-800">
                        SLA breached
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate">
                      {workOrder.asset?.name || workOrder.vehicle?.registrationNo || "No asset linked"}
                      {workOrder.asset?.assetTag ? ` · ${workOrder.asset.assetTag}` : ""}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-brand-800">Planning can continue after creation.</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
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
                            ["evidence", "Open evidence"],
                            ["assignment", "Open assignment"]
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
                  onClick={onClose}
                  className="btn-quiet h-10 px-2"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </header>

            {!isCreateMode && workOrder?.id ? (
              <WorkOrderDetailTabs activeTab={activeTab} onChange={setActiveTab} showAudit={showAuditTab} />
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
              onSubmit={(event) => {
                event.preventDefault();

                if (!formState.title.trim() || !formState.description.trim()) {
                  return;
                }

                if (isCreateMode) {
                  return;
                }

                if (formState.dueDate && formState.expectedCompletionDate) {
                  const due = new Date(`${formState.dueDate}T00:00:00.000Z`);
                  const expected = new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`);
                  if (due.getTime() < expected.getTime()) {
                    setFormError("Expected completion must not be later than due date.");
                    return;
                  }
                }
                if (formState.estimatedCost.trim() !== "") {
                  const cost = Number(formState.estimatedCost);
                  if (!Number.isFinite(cost) || cost < 0) {
                    setFormError("Estimated cost cannot be negative.");
                    return;
                  }
                }
                if (formState.estimatedHours.trim() !== "") {
                  const hours = Number(formState.estimatedHours);
                  if (!Number.isFinite(hours) || hours <= 0) {
                    setFormError("Estimated hours must be greater than 0.");
                    return;
                  }
                }

                setFormError(null);
                onEdit({
                  title: formState.title.trim(),
                  description: formState.description.trim(),
                  dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString() : undefined,
                  expectedCompletionDate: formState.expectedCompletionDate
                    ? new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`).toISOString()
                    : undefined,
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
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
            >
              {formError ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
                  {formError}
                </p>
              ) : null}
              {!isCreateMode && activeTab !== "overview" ? null : (
              <section className="space-y-3 rounded-xl border border-brand-100 bg-white p-3">
                <h4 className="text-sm font-semibold text-ink">Details</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Title</span>
                  <input
                    required
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="field w-full"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Description</span>
                  <textarea
                    required
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    className="field h-auto min-h-24 w-full py-2"
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
                        onChange={(event) =>
                          setFormState((current) => ({ ...current, estimatedHours: event.target.value }))
                        }
                        className="field w-full"
                      />
                    </label>
                  </>
                )}

                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Due Date</span>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(event) => setFormState((current) => ({ ...current, dueDate: event.target.value }))}
                    className="field w-full"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Expected completion (requester)</span>
                  <input
                    type="date"
                    value={formState.expectedCompletionDate}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, expectedCompletionDate: event.target.value }))
                    }
                    className="field w-full"
                  />
                </label>

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
                  <SupervisorVerificationPanel
                    workOrderId={workOrder.id}
                    status={workOrder.status}
                    evidenceRequirements={evidenceRequirements}
                    onUpdated={onClose}
                  />
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
                <WorkOrderAssigneesPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "parts" ? (
                <PartRequestsPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "safety" ? (
                <WorkOrderSafetyPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "evidence" ? (
                <div className="space-y-4">
                  <WorkOrderActivityPanel
                    loading={activityLoading}
                    error={activityError}
                    timeline={activityTimeline}
                    workOrderId={undefined}
                    evidenceReadiness={null}
                    evidenceItems={[]}
                  />
                  <WorkOrderEvidencePanel
                    workOrderId={workOrder.id}
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
                />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "history" ? (
                <WorkOrderHistoryPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "audit" && showAuditTab ? (
                <WorkOrderAuditPanel workOrderId={workOrder.id} />
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t border-brand-100 bg-white px-4 py-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-quiet"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!isCreateMode && activeTab !== "overview")}
                  className="btn-primary disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isCreateMode ? "Create" : "Save Overview"}
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
