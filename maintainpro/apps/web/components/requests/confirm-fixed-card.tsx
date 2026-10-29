"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { ButtonSpinner } from "@/components/ui/loading";
import { getApiErrorMessage } from "@/lib/api-client";
import { confirmRequestFixed } from "@/lib/maintenance-requests-api";
import { confirmationIssues } from "@/lib/requester-confirmation";

/** Reporter answers "Is it fixed?". No sends the job back to the technician with the note. */
export function ConfirmFixedCard({
  requestId,
  woNumber,
  onBehalf = false,
  onDone
}: {
  requestId: string;
  woNumber: string;
  /** A reviewer answering for the reporter (for example the reporter has no login). */
  onBehalf?: boolean;
  onDone: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"ask" | "not-fixed">("ask");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(fixed: boolean) {
    const issue = confirmationIssues(fixed, note);
    if (issue) {
      setError(issue);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmRequestFixed(requestId, { fixed, note: note.trim() || undefined });
      toast.success(fixed ? "Thanks — marked as fixed." : "Sent back to the technician.");
      await onDone();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Your answer could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border-2 border-brand-300 bg-brand-50 p-4" aria-labelledby="confirm-fixed-title">
      <h2 id="confirm-fixed-title" className="text-base font-semibold text-slate-900">
        Is it fixed?
      </h2>
      <p className="mt-1 text-sm text-slate-700">
        {onBehalf
          ? `Job ${woNumber} is done and checked. Answer for the person who reported it after checking with them.`
          : `Job ${woNumber} is done and checked by the supervisor. Please check the machine, vehicle or place and tell us.`}
      </p>
      {mode === "ask" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(true)}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <ButtonSpinner /> : <CheckCircle2 size={16} aria-hidden />} Yes, it is fixed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("not-fixed")}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 disabled:opacity-60"
          >
            <XCircle size={16} aria-hidden /> No, still a problem
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label htmlFor="not-fixed-note" className="text-sm font-medium text-slate-800">
            What is still wrong?
          </label>
          <textarea
            id="not-fixed-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={busy}
              onClick={() => void send(false)}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? <ButtonSpinner /> : null} Send back for more work
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("ask");
                setError(null);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700"
            >
              Back
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
