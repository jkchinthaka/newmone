"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

import { LiveCameraCapture, type LiveCapture } from "@/components/evidence/live-camera-capture";
import { ButtonSpinner } from "@/components/ui/loading";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { canWaivePhotos, PHOTO_WAIVER_MIN_REASON } from "@/lib/photo-waiver";
import { useCurrentUser } from "@/lib/use-current-user";
import { readCaptureLocation, uploadWorkOrderFile, type CaptureLocation } from "@/lib/work-order-photo-upload";

export type StartJobTarget = { id: string; woNumber: string; title?: string | null; version?: number | null };

type Phase = "checking" | "photo" | "ready" | "starting";

type EvidenceListItem = { evidenceType?: string; status?: string; verificationStatus?: string | null };

function hasUsableBeforePhoto(items: EvidenceListItem[]): boolean {
  return items.some(
    (item) => item.evidenceType === "BEFORE_PHOTO" && item.status === "UPLOADED" && item.verificationStatus !== "REJECTED"
  );
}

/**
 * Start = take a live before photo of the machine/place, then the job moves to Working.
 * The API enforces the same rule (START_PHOTO_REQUIRED), so this dialog is the friendly path,
 * not the only check. When photo storage is not set up the job starts without a photo.
 */
export function StartJobDialog({
  job,
  onClose,
  onStarted
}: {
  job: StartJobTarget;
  onClose: () => void;
  onStarted: () => void | Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [storageOff, setStorageOff] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationRef = useRef<Promise<CaptureLocation | null> | null>(null);
  const user = useCurrentUser();
  const canWaive = canWaivePhotos(user.role);
  const [waiverReason, setWaiverReason] = useState("");

  /** Looks for a before photo already on the job (a team lead may have taken it for this person). */
  const checkPhoto = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const response = await apiClient.get(`/work-orders/${job.id}/evidence`);
      const body = response.data?.data as { items?: EvidenceListItem[] } | EvidenceListItem[] | undefined;
      const items = Array.isArray(body) ? body : body?.items ?? [];
      if (!isCancelled()) setPhase(hasUsableBeforePhoto(items) ? "ready" : "photo");
    } catch {
      if (!isCancelled()) setPhase("photo");
    }
  }, [job.id]);

  useEffect(() => {
    // Ask for the phone location early so it is ready by the time the photo is taken (optional).
    locationRef.current = readCaptureLocation();
    let cancelled = false;
    void checkPhoto(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [checkPhoto]);

  async function useBeforePhoto(capture: LiveCapture): Promise<boolean> {
    setUploading(true);
    setError(null);
    try {
      const location = await (locationRef.current ?? Promise.resolve(null));
      const result = await uploadWorkOrderFile({
        workOrderId: job.id,
        file: capture.blob,
        fileName: capture.fileName,
        mimeType: capture.mimeType,
        evidenceType: "BEFORE_PHOTO",
        source: "LIVE_CAMERA",
        location
      });
      if (result.ok) {
        setPhase("ready");
        return true;
      }
      if (result.blocked) {
        // Nowhere to store photos on this server. Test/dev servers waive the photo; the live
        // server refuses Start with PHOTO_STORAGE_UNAVAILABLE and the message below says why.
        setStorageOff(true);
        setPhase("ready");
        return true;
      }
      setError(result.message);
      return false;
    } finally {
      setUploading(false);
    }
  }

  async function start(overrideReason?: string) {
    setPhase("starting");
    setError(null);
    try {
      await apiClient.post(`/work-orders/${job.id}/start`, {
        expectedVersion: job.version ?? undefined,
        ...(overrideReason ? { overrideReason } : {})
      });
      toast.success(`${job.woNumber} started.`);
      await onStarted();
    } catch (cause) {
      const code = (cause as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code;
      setError(getApiErrorMessage(cause, "This job could not be started."));
      setPhase(code === "START_PHOTO_REQUIRED" ? "photo" : "ready");
    }
  }

  const steps = ["Before photo", "Start job"];
  const current = phase === "ready" || phase === "starting" ? 1 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-job-title"
        className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="start-job-title" className="text-base font-semibold text-slate-900">
              Start {job.woNumber}
            </h2>
            {job.title ? <p className="truncate text-sm text-slate-600">{job.title}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X size={18} aria-hidden />
          </button>
        </div>

        <ol className="mt-3 flex items-center gap-2 text-xs" aria-label="Start steps">
          {steps.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              {index > 0 ? <span className={`h-0.5 w-6 ${index <= current ? "bg-brand-600" : "bg-slate-200"}`} aria-hidden /> : null}
              <span className={`inline-flex items-center gap-1 ${index === current ? "font-semibold text-brand-800" : index < current ? "text-brand-700" : "text-slate-400"}`}>
                {index < current ? <CheckCircle2 size={14} aria-hidden /> : <span aria-hidden>{index + 1}.</span>}
                {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-4">
          {phase === "checking" ? (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <ButtonSpinner /> Checking the job…
            </p>
          ) : phase === "photo" ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-700">
                Take a photo of the machine, vehicle or place <strong>before</strong> you start the work.
              </p>
              <LiveCameraCapture captureLabel="Take before photo" useLabel="Use photo and continue" busy={uploading} onUse={useBeforePhoto} />
              <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <summary className="cursor-pointer font-medium text-slate-800">No phone or camera?</summary>
                {canWaive ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-slate-700">
                      You can start this job without a photo. The reason is saved on the job and in the audit log.
                    </p>
                    <input
                      value={waiverReason}
                      onChange={(event) => setWaiverReason(event.target.value)}
                      placeholder="Why is there no photo? (for example: technician has no phone)"
                      aria-label="Reason for starting without a photo"
                      className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                    />
                    <button
                      type="button"
                      disabled={waiverReason.trim().length < PHOTO_WAIVER_MIN_REASON}
                      onClick={() => void start(waiverReason.trim())}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 disabled:opacity-50"
                    >
                      Start without a photo
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p className="text-slate-700">
                      Ask your supervisor or manager to take the before photo on their phone (open this job, then Photos), or to
                      start the job for you. Then tap Check again.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPhase("checking");
                        void checkPhoto();
                      }}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800"
                    >
                      Check again
                    </button>
                  </div>
                )}
              </details>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 size={16} aria-hidden />
                {storageOff
                  ? "Photo storage is not set up on this server. If Start is refused, ask an admin to set up photo storage."
                  : "Before photo saved."}
              </p>
              <button
                type="button"
                disabled={phase === "starting"}
                onClick={() => void start()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                {phase === "starting" ? <ButtonSpinner /> : null}
                Start job
              </button>
            </div>
          )}
          {error ? (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
