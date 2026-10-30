"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2, RefreshCw, X } from "lucide-react";

import { apiClient } from "@/lib/api-client";
import {
  buildCompletionChecklist,
  completionBlockReason,
  readCompletionDraft,
  saveCompletionDraft,
  type CompletionChecklistTab
} from "@/lib/work-order-completion-checklist";
import type { WorkOrderEvidenceRequirements } from "@/lib/work-order-evidence";

import type { WorkOrder } from "./types";
import { getWorkOrderDueUrgency } from "./helpers";
import {
  getWorkOrderPartsSummary,
  listWorkOrderPartLines,
  type WorkOrderPartLine,
  type WorkOrderPartsCostSummary
} from "./work-order-parts-api";

type CompletionDraftValues = {
  delayReason: string;
  completionNote: string;
  failureCode: string;
  causeCode: string;
  remedyCode: string;
  completionCondition: string;
  followUpRequired: boolean;
  followUpNote: string;
  functionalTestResult: string;
  roadTestResult: string;
  completionMeterReading: string;
  operatingRestriction: string;
  productionImpact: string;
};

type ChecklistData = {
  loading: boolean;
  failed: boolean;
  requirements: WorkOrderEvidenceRequirements | null;
  partLines: WorkOrderPartLine[] | null;
  partsSummary: WorkOrderPartsCostSummary | null;
};

const EMPTY_CHECKLIST: ChecklistData = {
  loading: false,
  failed: false,
  requirements: null,
  partLines: null,
  partsSummary: null
};

type CompleteWorkOrderModalProps = {
  open: boolean;
  workOrder: WorkOrder | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    delayReason?: string;
    completionNote: string;
    failureCode?: string;
    causeCode?: string;
    remedyCode?: string;
    completionCondition?: string;
    followUpRequired?: boolean;
    followUpNote?: string;
    functionalTestResult?: string;
    roadTestResult?: string;
    completionMeterReading?: number;
    operatingRestriction?: string;
    productionImpact?: string;
  }) => void;
  technicianMode?: boolean;
  /** Optional: lets checklist lines jump to the Evidence / Parts tab of this job. */
  onOpenTab?: (tab: CompletionChecklistTab) => void;
};

export function CompleteWorkOrderModal({
  open,
  workOrder,
  submitting,
  onClose,
  onSubmit,
  technicianMode = true,
  onOpenTab
}: CompleteWorkOrderModalProps) {
  const [delayReason, setDelayReason] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [failureCode, setFailureCode] = useState("");
  const [causeCode, setCauseCode] = useState("");
  const [remedyCode, setRemedyCode] = useState("");
  const [completionCondition, setCompletionCondition] = useState("FIXED");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");
  const [functionalTestResult, setFunctionalTestResult] = useState("NOT_REQUIRED");
  const [roadTestResult, setRoadTestResult] = useState("NOT_REQUIRED");
  const [completionMeterReading, setCompletionMeterReading] = useState("");
  const [operatingRestriction, setOperatingRestriction] = useState("");
  const [productionImpact, setProductionImpact] = useState("NONE");

  const requiresDelayReason = workOrder ? getWorkOrderDueUrgency(workOrder).level === "OVERDUE" : false;
  const jobDomain = String((workOrder as { jobDomain?: string } | null)?.jobDomain ?? "").toUpperCase();
  const isVehicle = jobDomain === "VEHICLE";
  const isMachinery = jobDomain === "MACHINERY";
  const isService = jobDomain === "SERVICE";
  const workOrderId = workOrder?.id ?? "";
  const workOrderStatus = String(workOrder?.status ?? "");
  /** Which work order the fields were last filled for; drafts save only after that. */
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [checklistData, setChecklistData] = useState<ChecklistData>(EMPTY_CHECKLIST);

  // Fill the form when it opens: the saved draft for this job, or fresh defaults.
  // Closing and reopening the same job keeps what was typed.
  useEffect(() => {
    if (!open || !workOrderId) {
      setHydratedFor(null);
      return;
    }
    const draft = readCompletionDraft<CompletionDraftValues>(workOrderId, workOrderStatus);
    setDelayReason(draft?.delayReason ?? "");
    setCompletionNote(draft?.completionNote ?? "");
    setFailureCode(draft?.failureCode ?? "");
    setCauseCode(draft?.causeCode ?? "");
    setRemedyCode(draft?.remedyCode ?? "");
    setCompletionCondition(draft?.completionCondition ?? "FIXED");
    setFollowUpRequired(draft?.followUpRequired ?? false);
    setFollowUpNote(draft?.followUpNote ?? "");
    setFunctionalTestResult(draft?.functionalTestResult ?? (isMachinery || isService ? "PASS" : "NOT_REQUIRED"));
    setRoadTestResult(draft?.roadTestResult ?? (isVehicle ? "PASS" : "NOT_REQUIRED"));
    setCompletionMeterReading(draft?.completionMeterReading ?? "");
    setOperatingRestriction(draft?.operatingRestriction ?? "");
    setProductionImpact(draft?.productionImpact ?? "NONE");
    setHydratedFor(workOrderId);
  }, [open, workOrderId, workOrderStatus, isMachinery, isService, isVehicle]);

  useEffect(() => {
    if (!open || !workOrderId || hydratedFor !== workOrderId) {
      return;
    }
    const values: CompletionDraftValues = {
      delayReason,
      completionNote,
      failureCode,
      causeCode,
      remedyCode,
      completionCondition,
      followUpRequired,
      followUpNote,
      functionalTestResult,
      roadTestResult,
      completionMeterReading,
      operatingRestriction,
      productionImpact
    };
    saveCompletionDraft(workOrderId, workOrderStatus, values);
  }, [
    open,
    workOrderId,
    workOrderStatus,
    hydratedFor,
    delayReason,
    completionNote,
    failureCode,
    causeCode,
    remedyCode,
    completionCondition,
    followUpRequired,
    followUpNote,
    functionalTestResult,
    roadTestResult,
    completionMeterReading,
    operatingRestriction,
    productionImpact
  ]);

  // Same sources as the Evidence and Parts tabs, so the checklist matches what the server checks.
  const loadChecklist = useCallback(async (id: string, isCancelled: () => boolean = () => false) => {
    setChecklistData((current) => ({ ...current, loading: true, failed: false }));
    const [evidence, lines, summary] = await Promise.allSettled([
      apiClient.get(`/work-orders/${id}/evidence`),
      listWorkOrderPartLines(id),
      getWorkOrderPartsSummary(id)
    ]);
    if (isCancelled()) return;
    const requirements =
      evidence.status === "fulfilled"
        ? ((evidence.value.data?.data as { requirements?: WorkOrderEvidenceRequirements } | undefined)?.requirements ?? null)
        : null;
    setChecklistData({
      loading: false,
      failed: evidence.status === "rejected" || lines.status === "rejected" || summary.status === "rejected",
      requirements,
      partLines: lines.status === "fulfilled" ? lines.value : null,
      partsSummary: summary.status === "fulfilled" ? summary.value : null
    });
  }, []);

  useEffect(() => {
    if (!open || !workOrderId) {
      setChecklistData(EMPTY_CHECKLIST);
      return;
    }
    let cancelled = false;
    void loadChecklist(workOrderId, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [open, workOrderId, loadChecklist]);

  const checklist = buildCompletionChecklist({
    requirements: checklistData.requirements,
    partLines: checklistData.partLines,
    partsSummary: checklistData.partsSummary,
    isVehicle,
    odometer: completionMeterReading
  });
  const productionImpactField = (<label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Production impact</span>
                  <select
                    value={productionImpact}
                    onChange={(e) => setProductionImpact(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="NONE">No production impact</option>
                    <option value="REDUCED">Production reduced</option>
                    <option value="STOPPED">Production stopped</option>
                  </select>
                </label>);

  // Technician's one question; it sets the test result and fixed / temporary fix underneath.
  const working: "" | "YES" | "PARTLY" | "NO" =
    functionalTestResult === "PASS" ? "YES" : functionalTestResult === "PARTIAL" ? "PARTLY" : functionalTestResult === "FAIL" ? "NO" : "";
  const chooseWorking = (value: "YES" | "PARTLY" | "NO") => {
    setFunctionalTestResult(value === "YES" ? "PASS" : value === "PARTLY" ? "PARTIAL" : "FAIL");
    setCompletionCondition(value === "YES" ? "FIXED" : value === "PARTLY" ? "TEMPORARY_FIX" : "NOT_FIXED");
    setFollowUpRequired(value === "PARTLY");
  };
  const technicianChoiceMissing = technicianMode && (working === "" || working === "NO");

  const blockReason = checklistData.loading ? "Checking what is needed..." : completionBlockReason(checklist);

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
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {technicianMode ? "Mark as done" : "Complete job"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {technicianMode
                    ? `Submit completion details for ${workOrder?.woNumber ?? "this work order"}. A supervisor must verify before closing.`
                    : `Record the completion note for ${workOrder?.woNumber ?? "this work order"}.`}
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (blockReason) {
                  return;
                }
                if (requiresDelayReason && !delayReason.trim()) {
                  return;
                }
                if (!completionNote.trim()) {
                  return;
                }
                if (isVehicle && !completionMeterReading.trim()) {
                  return;
                }
                if (completionCondition === "TEMPORARY_FIX" && !followUpRequired && !operatingRestriction.trim()) {
                  return;
                }

                onSubmit({
                  delayReason: delayReason.trim() || undefined,
                  completionNote: completionNote.trim(),
                  failureCode: failureCode.trim() || undefined,
                  causeCode: causeCode.trim() || undefined,
                  remedyCode: remedyCode.trim() || undefined,
                  completionCondition,
                  followUpRequired,
                  followUpNote: followUpNote.trim() || undefined,
                  functionalTestResult,
                  roadTestResult,
                  completionMeterReading: completionMeterReading.trim()
                    ? Number(completionMeterReading)
                    : undefined,
                  operatingRestriction: operatingRestriction.trim() || undefined,
                  productionImpact: isMachinery ? productionImpact : undefined
                });
              }}
              className="space-y-4 px-5 py-4"
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" aria-live="polite">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Before you submit</p>
                  <button
                    type="button"
                    disabled={checklistData.loading || !workOrderId}
                    onClick={() => void loadChecklist(workOrderId)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                  >
                    {checklistData.loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Check again
                  </button>
                </div>
                {checklistData.loading ? (
                  <p className="mt-2 text-xs text-slate-600">Checking photos, QR and parts...</p>
                ) : null}
                {checklistData.failed ? (
                  <p className="mt-2 text-xs text-amber-800">Could not check everything. Tap Check again.</p>
                ) : null}
                {checklist.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {checklist.map((item) => (
                      <li key={item.key} className="flex items-start gap-2 text-sm">
                        {item.met ? (
                          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                        ) : (
                          <Circle size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className={item.met ? "text-slate-700" : "font-medium text-slate-900"}>
                            {item.label}
                            <span className="sr-only">{item.met ? " — done" : " — not done"}</span>
                          </p>
                          {!item.met ? <p className="text-xs text-amber-800">{item.help}</p> : null}
                          {!item.met && item.tab && onOpenTab ? (
                            <button
                              type="button"
                              onClick={() => onOpenTab(item.tab as CompletionChecklistTab)}
                              className="mt-1 inline-flex min-h-9 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-brand-700"
                            >
                              {item.tab === "parts" ? "Go to Parts" : "Go to photos"}
                            </button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : !checklistData.loading ? (
                  <p className="mt-2 text-xs text-slate-600">No photos, QR scan or parts needed for this job.</p>
                ) : null}
              </div>

              {technicianMode ? (
                <fieldset>
                  <legend className="text-sm font-medium text-slate-800">Is it fixed and working now? (required)</legend>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Is it fixed and working now?">
                    {(
                      [
                        ["YES", "Yes", "border-emerald-500 bg-emerald-50 text-emerald-900"],
                        ["PARTLY", "Partly", "border-amber-500 bg-amber-50 text-amber-900"],
                        ["NO", "No", "border-red-500 bg-red-50 text-red-900"]
                      ] as const
                    ).map(([value, label, selectedClass]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={working === value}
                        onClick={() => chooseWorking(value)}
                        className={`min-h-12 rounded-lg border-2 text-base font-semibold ${working === value ? selectedClass : "border-slate-200 text-slate-700"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {working === "NO" ? (
                    <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
                      A job that is not working cannot be finished. Press Cancel and use <strong>Hold</strong> with the reason (for example waiting for a part).
                    </p>
                  ) : null}
                  {working === "PARTLY" ? (
                    <label className="mt-2 block space-y-1 text-sm text-slate-700">
                      <span className="font-medium">What still needs doing, and any limit until then? (required)</span>
                      <textarea
                        rows={2}
                        required
                        value={operatingRestriction || followUpNote}
                        onChange={(e) => {
                          setOperatingRestriction(e.target.value);
                          setFollowUpNote(e.target.value);
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="e.g. Seal is temporary, run at half speed until the new seal comes"
                      />
                    </label>
                  ) : null}
                </fieldset>
              ) : null}

              {requiresDelayReason ? (
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Delay reason (required — overdue)</span>
                  <textarea
                    required
                    rows={2}
                    value={delayReason}
                    onChange={(event) => setDelayReason(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                    placeholder="Explain why completion was delayed..."
                  />
                </label>
              ) : null}

              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">{technicianMode ? "What did you do? (required)" : "Technician completion note (required)"}</span>
                <textarea
                  required
                  rows={3}
                  value={completionNote}
                  onChange={(event) => setCompletionNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  placeholder="Describe work performed, parts used, and test results..."
                />
              </label>

              <OptionalDetails collapsed={technicianMode}>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Failure</span>
                  <input
                    value={failureCode}
                    onChange={(e) => setFailureCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="e.g. LEAK"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Cause</span>
                  <input
                    value={causeCode}
                    onChange={(e) => setCauseCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="e.g. WEAR"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Remedy</span>
                  <input
                    value={remedyCode}
                    onChange={(e) => setRemedyCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="e.g. REPLACED"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">Functional test</span>
                  <select
                    value={functionalTestResult}
                    onChange={(e) => setFunctionalTestResult(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="NOT_REQUIRED">NOT_REQUIRED</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">{isVehicle ? "Road / workshop test" : "Area / release test"}</span>
                  <select
                    value={roadTestResult}
                    onChange={(e) => setRoadTestResult(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="NOT_REQUIRED">NOT_REQUIRED</option>
                    <option value="ROAD_TEST_PASS">ROAD_TEST_PASS</option>
                    <option value="WORKSHOP_TEST_PASS">WORKSHOP_TEST_PASS</option>
                    <option value="ROAD_TEST_NOT_REQUIRED">ROAD_TEST_NOT_REQUIRED</option>
                  </select>
                </label>
              </div>
              {isMachinery && technicianMode ? productionImpactField : null}
              </OptionalDetails>

              {(isVehicle || isMachinery) && (
                <label className="space-y-1 text-sm text-slate-700">
                  <span className="font-medium">
                    {isVehicle ? "Current odometer (required)" : "Meter reading (optional)"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    required={isVehicle}
                    value={completionMeterReading}
                    onChange={(e) => setCompletionMeterReading(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder={isVehicle ? "Must be ≥ last accepted odometer" : "Must be ≥ last accepted reading"}
                  />
                </label>
              )}

              {isMachinery && !technicianMode ? productionImpactField : null}

              {technicianMode ? null : (
                <>
              <label className="space-y-1 text-sm text-slate-700">
                <span className="font-medium">Completion condition</span>
                <select
                  value={completionCondition}
                  onChange={(e) => {
                    setCompletionCondition(e.target.value);
                    if (e.target.value === "TEMPORARY_FIX") {
                      setFollowUpRequired(true);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="FIXED">Fixed</option>
                  <option value="TEMPORARY_FIX">Temporary fix</option>
                  <option value="NEEDS_FOLLOW_UP">Needs follow-up</option>
                  <option value="NOT_FIXED">Not fixed</option>
                </select>
              </label>

              {completionCondition === "TEMPORARY_FIX" || followUpRequired ? (
                <>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={followUpRequired}
                      onChange={(e) => setFollowUpRequired(e.target.checked)}
                    />
                    Permanent follow-up required
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Operating restriction / follow-up note</span>
                    <textarea
                      rows={2}
                      value={operatingRestriction || followUpNote}
                      onChange={(e) => {
                        setOperatingRestriction(e.target.value);
                        setFollowUpNote(e.target.value);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="e.g. Max 40 km/h — permanent repair by next week"
                    />
                  </label>
                </>
              ) : null}

                </>
              )}

              {blockReason ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="status">
                  {blockReason}
                </p>
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
                  disabled={submitting || Boolean(blockReason) || technicianChoiceMissing}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {technicianMode ? "Finish job (supervisor checks it)" : "Save completion note"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Technicians see extra details folded away; other roles see them open. */
function OptionalDetails({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-slate-700">More details (optional): failure, cause, tests</summary>
      <div className="space-y-3 pb-2 pt-1">{children}</div>
    </details>
  );
}
