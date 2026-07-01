"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, AlertTriangle } from "lucide-react";

import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { canViewAuditHistoryForUser, useCurrentUser } from "@/lib/use-current-user";
import type { WorkOrderActivityTimelineResponse } from "@/lib/work-order-activity";
import { workOrderActivityUnavailableMessage } from "@/lib/work-order-activity";
import type { EvidenceStorageReadiness, WorkOrderEvidenceItem } from "@/lib/work-order-evidence";

import { asDateInputValue, requiresAssetOrVehicle, toTitleCase } from "./helpers";
import { WORK_ORDER_PRIORITIES, WORK_ORDER_TYPES, type UpdateWorkOrderInput, type WorkOrder } from "./types";
import { PartRequestsPanel } from "./part-requests-panel";
import { WorkOrderAssigneesPanel } from "./work-order-assignees-panel";
import { WorkOrderActivityPanel } from "./work-order-activity-panel";
import { WorkOrderAuditPanel } from "./work-order-audit-panel";
import { WorkOrderDetailTabs, type WorkOrderDetailTab } from "./work-order-detail-tabs";
import { WorkOrderEvidencePanel } from "./work-order-evidence-panel";
import { WorkOrderGovernanceBanner } from "./work-order-governance-banner";
import { SupervisorVerificationPanel } from "./supervisor-verification-panel";
import { useWorkOrderHistorySummary, WorkOrderHistoryPanel } from "./work-order-history-panel";

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
  scheduleId?: string;
};

type WorkOrderEditFormValue = UpdateWorkOrderInput;

type WorkOrderEditorModalProps = {
  open: boolean;
  mode: WorkOrderEditorMode;
  workOrder?: WorkOrder | null;
  submitting: boolean;
  onClose: () => void;
  onCreate: (values: WorkOrderCreateFormValue) => void;
  onEdit: (values: WorkOrderEditFormValue) => void;
};

export function WorkOrderEditorModal({
  open,
  mode,
  workOrder,
  submitting,
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
      assetId: workOrder?.assetId ?? "",
      vehicleId: workOrder?.vehicleId ?? "",
      scheduleId: workOrder?.scheduleId ?? "",
      estimatedCost: workOrder?.estimatedCost?.toString() ?? "",
      estimatedHours: workOrder?.estimatedHours?.toString() ?? ""
    }),
    [workOrder]
  );

  const [formState, setFormState] = useState(initialState);
  const [activeTab, setActiveTab] = useState<WorkOrderDetailTab>("overview");
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityTimeline, setActivityTimeline] = useState<WorkOrderActivityTimelineResponse | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceReadiness, setEvidenceReadiness] = useState<EvidenceStorageReadiness | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<WorkOrderEvidenceItem[]>([]);
  const currentUser = useCurrentUser();
  const showAuditTab = canViewAuditHistoryForUser(currentUser);
  const historySummary = useWorkOrderHistorySummary(!isCreateMode ? workOrder?.id : undefined);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFormState(initialState);
    setActiveTab("overview");
  }, [initialState, open]);

  useEffect(() => {
    if (!open || isCreateMode || !workOrder?.id) {
      setActivityTimeline(null);
      setActivityError(null);
      setActivityLoading(false);
      setEvidenceItems([]);
      setEvidenceReadiness(null);
      setEvidenceLoading(false);
      return;
    }

    let cancelled = false;

    const loadEvidence = async () => {
      setEvidenceLoading(true);
      try {
        const [readinessResponse, evidenceResponse] = await Promise.all([
          apiClient.get("/evidence/readiness"),
          apiClient.get(`/work-orders/${workOrder.id}/evidence`)
        ]);
        if (!cancelled) {
          setEvidenceReadiness(readinessResponse.data?.data as EvidenceStorageReadiness);
          const evidenceData = evidenceResponse.data?.data as { items?: WorkOrderEvidenceItem[] } | undefined;
          setEvidenceItems(evidenceData?.items ?? []);
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

    void loadActivity();
    void loadEvidence();

    return () => {
      cancelled = true;
    };
  }, [open, isCreateMode, workOrder?.id]);

  const assetRequired = isCreateMode && requiresAssetOrVehicle(formState.type);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {isCreateMode ? "Create Work Order" : `Work Order ${workOrder?.woNumber ?? ""}`}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isCreateMode
                    ? "Provide details to create a new work order."
                    : "Review details, assignments, history, and audit events for this job."}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {!isCreateMode && workOrder?.id ? (
              <WorkOrderDetailTabs activeTab={activeTab} onChange={setActiveTab} showAudit={showAuditTab} />
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();

                if (!formState.title.trim() || !formState.description.trim()) {
                  return;
                }

                if (isCreateMode) {
                  onCreate({
                    title: formState.title.trim(),
                    description: formState.description.trim(),
                    priority: formState.priority,
                    type: formState.type,
                    dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString() : undefined,
                    expectedCompletionDate: formState.expectedCompletionDate
                      ? new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`).toISOString()
                      : undefined,
                    assetId: formState.assetId.trim() || undefined,
                    vehicleId: formState.vehicleId.trim() || undefined,
                    scheduleId: formState.scheduleId.trim() || undefined
                  });
                  return;
                }

                onEdit({
                  title: formState.title.trim(),
                  description: formState.description.trim(),
                  dueDate: formState.dueDate ? new Date(`${formState.dueDate}T00:00:00.000Z`).toISOString() : undefined,
                  expectedCompletionDate: formState.expectedCompletionDate
                    ? new Date(`${formState.expectedCompletionDate}T00:00:00.000Z`).toISOString()
                    : undefined,
                  estimatedCost: formState.estimatedCost ? Number(formState.estimatedCost) : undefined,
                  estimatedHours: formState.estimatedHours ? Number(formState.estimatedHours) : undefined
                });
              }}
              className="space-y-4 px-5 py-4"
            >
              {!isCreateMode && activeTab !== "overview" ? null : (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Title</span>
                  <input
                    required
                    value={formState.title}
                    onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  />
                </label>

                <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                  <span className="font-medium">Description</span>
                  <textarea
                    required
                    value={formState.description}
                    onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
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
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  />
                </label>

                {isCreateMode ? (
                  <>
                    <label className="space-y-1 text-sm text-slate-700">
                      <span className="font-medium">
                        Asset {assetRequired ? "(required for this type — or link a vehicle)" : "(optional)"}
                      </span>
                      <p className="text-xs text-slate-500">
                        General CORRECTIVE/EMERGENCY tasks may omit asset and vehicle. PREVENTIVE, INSPECTION, and
                        INSTALLATION require at least one link.
                      </p>
                      <EntityPicker
                        endpoint="/assets"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                      />
                    </label>
                  </>
                ) : null}
              </div>
              )}

              {!isCreateMode && workOrder && activeTab === "overview" ? (
                <div className="space-y-3">
                  <WorkOrderGovernanceBanner workOrder={workOrder} />
                  <SupervisorVerificationPanel
                    workOrderId={workOrder.id}
                    status={workOrder.status}
                    onUpdated={onClose}
                  />
                </div>
              ) : null}

              {!isCreateMode && activeTab === "overview" && historySummary.data?.repeatIssueWarnings.length ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <div>
                      <p className="font-semibold">Repeated issue detected for this asset/vehicle.</p>
                      <p className="mt-1 text-xs">Open the History tab for prior maintenance context.</p>
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
                    loading={evidenceLoading}
                    onRefresh={async () => {
                      const evidenceResponse = await apiClient.get(`/work-orders/${workOrder.id}/evidence`);
                      const evidenceData = evidenceResponse.data?.data as { items?: WorkOrderEvidenceItem[] } | undefined;
                      setEvidenceItems(evidenceData?.items ?? []);
                    }}
                  />
                </div>
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "history" ? (
                <WorkOrderHistoryPanel workOrderId={workOrder.id} />
              ) : null}

              {!isCreateMode && workOrder?.id && activeTab === "audit" && showAuditTab ? (
                <WorkOrderAuditPanel workOrderId={workOrder.id} />
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (!isCreateMode && activeTab !== "overview")}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {isCreateMode ? "Create" : "Save Overview"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
