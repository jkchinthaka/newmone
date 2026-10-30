"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import type { WorkOrderEvidenceRequirements } from "@/lib/work-order-evidence";

type Props = {
  workOrderId: string;
  status: string;
  expectedVersion: number;
  evidenceRequirements?: WorkOrderEvidenceRequirements | null;
  canRequestRework?: boolean;
  onUpdated?: () => void;
};

export function SupervisorVerificationPanel({
  workOrderId,
  status,
  expectedVersion,
  evidenceRequirements,
  canRequestRework = true,
  onUpdated
}: Props) {
  const [verificationNote, setVerificationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<"verify" | "rework" | null>(null);

  if (status !== "TECHNICIAN_COMPLETED") {
    return null;
  }

  async function verify() {
    setBusy(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/verify-supervisor`, {
        verificationNote: verificationNote.trim() || undefined,
        expectedVersion
      });
      toast.success("Job verified. Close it when the job is finished.");
      onUpdated?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not verify job."));
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
      toast.success("Job sent back to be fixed again.");
      onUpdated?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not reject supervisor check."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
      <h4 className="text-sm font-semibold text-slate-900">Supervisor check</h4>
      <p className="mt-1 text-xs text-slate-600">
        Supervisor check marks this job Verified. It is not closed until an authorized user closes it. Rejection returns it to be fixed again.
      </p>

      {evidenceRequirements ? (
        <div className="mt-3 rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Photos summary</p>
          <ul className="mt-1 space-y-1">
            <li>Before photos: {evidenceRequirements.beforeCount}</li>
            <li>After photos: {evidenceRequirements.afterCount}</li>
            <li>Completion note: {evidenceRequirements.completionNoteProvided ? "Provided" : "Missing"}</li>
            <li>QR status: {evidenceRequirements.qrRequired ? evidenceRequirements.qrVerificationStatus : "Not required"}</li>
            {evidenceRequirements.rejectedCount > 0 ? (
              <li className="text-red-700">Rejected evidence: {evidenceRequirements.rejectedCount}</li>
            ) : null}
            {!evidenceRequirements.complete && evidenceRequirements.required ? (
              <li className="font-medium text-amber-800">Supervisor check blocked because required photos are missing.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <label className="mt-3 block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Supervisor check note (optional)</span>
        <textarea
          rows={2}
          value={verificationNote}
          onChange={(event) => setVerificationNote(event.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {canRequestRework ? (
        <label className="mt-3 block space-y-1 text-sm">
          <span className="font-medium text-slate-700">Rejection reason</span>
          <textarea
            rows={2}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Required if sending back to be fixed again"
          />
        </label>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => setPendingAction("verify")}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Verify
        </button>
        {canRequestRework ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (rejectionReason.trim().length < 3) {
                toast.error("Reason required for this action.");
                return;
              }
              setPendingAction("rework");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-70"
          >
            <XCircle size={14} />
            Send back
          </button>
        ) : null}
      </div>
      {pendingAction ? (
        <div className="mt-3 rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-800">
          <p>
            {pendingAction === "verify"
              ? "Verify this completion? The job stays open until it is closed."
              : "Send this job back to be fixed again?"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const action = pendingAction;
                setPendingAction(null);
                if (action === "verify") void verify();
                else void reject();
              }}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-70"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingAction(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
