"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { WorkOrderEvidenceRequirements } from "@/lib/work-order-evidence";

type Props = {
  workOrderId: string;
  status: string;
  evidenceRequirements?: WorkOrderEvidenceRequirements | null;
  onUpdated?: () => void;
};

export function SupervisorVerificationPanel({
  workOrderId,
  status,
  evidenceRequirements,
  onUpdated
}: Props) {
  const [verificationNote, setVerificationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);

  if (status !== "TECHNICIAN_COMPLETED") {
    return null;
  }

  async function verify() {
    setBusy(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/verify-supervisor`, {
        verificationNote: verificationNote.trim() || undefined
      });
      toast.success("Work order verified and closed.");
      onUpdated?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not verify work order."));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (rejectionReason.trim().length < 3) {
      toast.error("Reason required for this action.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/reject-supervisor`, {
        reason: rejectionReason.trim()
      });
      toast.success("Work order sent back for rework.");
      onUpdated?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not reject verification."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Supervisor verification</h4>
      <p className="mt-1 text-xs text-slate-600">
        Verify technician completion before closing this job, or reject with a reason to require rework.
      </p>

      {evidenceRequirements ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Evidence summary</p>
          <ul className="mt-1 space-y-1">
            <li>Before photos: {evidenceRequirements.beforeCount}</li>
            <li>After photos: {evidenceRequirements.afterCount}</li>
            <li>Completion note: {evidenceRequirements.completionNoteProvided ? "Provided" : "Missing"}</li>
            <li>QR status: {evidenceRequirements.qrRequired ? evidenceRequirements.qrVerificationStatus : "Not required"}</li>
            {evidenceRequirements.rejectedCount > 0 ? (
              <li className="text-red-700">Rejected evidence: {evidenceRequirements.rejectedCount}</li>
            ) : null}
            {!evidenceRequirements.complete && evidenceRequirements.required ? (
              <li className="font-medium text-amber-800">Supervisor verification blocked because required evidence is missing.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Verification note (optional)</span>
        <textarea
          rows={2}
          value={verificationNote}
          onChange={(event) => setVerificationNote(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Rejection reason</span>
        <textarea
          rows={2}
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          placeholder="Required if sending back for rework"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void verify()}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Verify & close
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void reject()}
          className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
        >
          <XCircle size={14} />
          Reject & require rework
        </button>
      </div>
    </section>
  );
}
