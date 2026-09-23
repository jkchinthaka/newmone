"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, X } from "lucide-react";

import type { WorkOrder } from "./types";
import { getWorkOrderDueUrgency } from "./helpers";

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
};

export function CompleteWorkOrderModal({
  open,
  workOrder,
  submitting,
  onClose,
  onSubmit,
  technicianMode = true
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

  useEffect(() => {
    if (!open) {
      return;
    }

    setDelayReason("");
    setCompletionNote("");
    setFailureCode("");
    setCauseCode("");
    setRemedyCode("");
    setCompletionCondition("FIXED");
    setFollowUpRequired(false);
    setFollowUpNote("");
    setFunctionalTestResult(isMachinery || isService ? "PASS" : "NOT_REQUIRED");
    setRoadTestResult(isVehicle ? "PASS" : "NOT_REQUIRED");
    setCompletionMeterReading("");
    setOperatingRestriction("");
    setProductionImpact("NONE");
  }, [open, workOrder, isMachinery, isService, isVehicle]);

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
                  {technicianMode ? "Mark Technician Completed" : "Complete Work Order"}
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
              {technicianMode ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Actual hours and cost are calculated by the server from labour sessions and parts.
                  Failed tests block completion/release.
                </div>
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
                <span className="font-medium">Technician completion note (required)</span>
                <textarea
                  required
                  rows={3}
                  value={completionNote}
                  onChange={(event) => setCompletionNote(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-100 transition focus:border-brand-400 focus:ring-4"
                  placeholder="Describe work performed, parts used, and test results..."
                />
              </label>

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

              {isMachinery ? (
                <label className="space-y-1 text-sm text-slate-700">
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
                </label>
              ) : null}

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
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {technicianMode ? "Submit completion for verification" : "Save completion note"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
