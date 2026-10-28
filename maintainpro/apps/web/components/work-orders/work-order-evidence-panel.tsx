"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, FileText, Loader2, QrCode, UploadCloud, WifiOff, XCircle } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { apiBaseUrl } from "@/lib/api-url";
import { formatDrawerDateTime } from "@/lib/work-order-drawer-display";
import { useCurrentUser } from "@/lib/use-current-user";
import { EvidencePicker, type EvidencePickerFile } from "@/components/evidence/evidence-picker";
import { LiveCameraCapture, type LiveCapture } from "@/components/evidence/live-camera-capture";
import { isLivePhotoEvidenceType, readCaptureLocation, uploadWorkOrderFile } from "@/lib/work-order-photo-upload";
import { QrScanner } from "@/components/qr/qr-scanner";
import {
  enqueueOfflineEvidenceDraft,
  isBrowserOnline,
  readOfflineEvidenceQueue,
  type OfflineEvidenceDraft,
  updateOfflineEvidenceDraft
} from "@/lib/work-order-evidence-offline";
import {
  canOverrideQrMismatch,
  canReviewWorkOrderEvidence,
  canUploadWorkOrderEvidence,
  defaultEvidenceType,
  EVIDENCE_TYPE_OPTIONS,
  evidenceTypeAfterUpload,
  isQrMismatchMessage,
  isQrVerified,
  QR_OVERRIDE_MIN_REASON,
  qrStatusLabel,
  evidencePayloadHasSecrets,
  evidenceTypeLabel,
  evidenceUploadDisabledMessage,
  offlineEvidenceRetryBlock,
  formatAllowedEvidenceMimeTypes,
  formatEvidenceFileSize,
  isEvidenceUploadEnabled,
  verificationStatusLabel,
  type EvidenceStorageReadiness,
  type WorkOrderEvidenceItem,
  type WorkOrderEvidenceListResponse,
  type WorkOrderEvidenceRequirements
} from "@/lib/work-order-evidence";

function EvidenceThumb({ workOrderId, item }: { workOrderId: string; item: WorkOrderEvidenceItem }) {
  const [failed, setFailed] = useState(false);
  const when = formatDrawerDateTime(item.capturedAt || item.createdAt);
  const label = `${evidenceTypeLabel(item.evidenceType)}${when ? ` · ${when}` : ""}`;
  if (!item.downloadAvailable || failed) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-6 text-center text-xs text-slate-700">
        {label}
      </div>
    );
  }
  return (
    <img
      src={`${apiBaseUrl}/work-orders/${encodeURIComponent(workOrderId)}/evidence/${encodeURIComponent(item.id)}/content`}
      alt={evidenceTypeLabel(item.evidenceType)}
      className="h-24 w-full rounded-lg border border-slate-200 object-cover"
      onError={() => setFailed(true)}
    />
  );
}

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

type WorkOrderEvidencePanelProps = {
  workOrderId: string;
  readiness: EvidenceStorageReadiness | null;
  items: WorkOrderEvidenceItem[];
  requirements?: WorkOrderEvidenceRequirements | null;
  assetId?: string | null;
  vehicleId?: string | null;
  loading?: boolean;
  onRefresh?: () => Promise<void> | void;
  readOnly?: boolean;
};

type EvidenceUploadRequestResultLike = {
  ok: boolean;
  attachmentId?: string;
  uploadMethod?: string;
  message?: string;
};

export function WorkOrderEvidencePanel({
  workOrderId,
  readiness,
  items,
  requirements,
  assetId,
  vehicleId,
  loading = false,
  onRefresh,
  readOnly = false
}: WorkOrderEvidencePanelProps) {
  const currentUser = useCurrentUser();
  const [submitting, setSubmitting] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<"idle" | "uploading" | "failed">("idle");
  // Before photo first; once one exists (or right after a before upload) default to After.
  const [evidenceType, setEvidenceType] = useState(() => defaultEvidenceType(items));
  const [uploadNote, setUploadNote] = useState("");
  const [pendingFile, setPendingFile] = useState<EvidencePickerFile | null>(null);
  const [qrInput, setQrInput] = useState("");
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  /** Value that failed to match (camera or typed). Drives the "Tag missing or damaged?" help. */
  const [qrMismatchValue, setQrMismatchValue] = useState<string | null>(null);
  const [qrOverrideReason, setQrOverrideReason] = useState("");
  const [qrError, setQrError] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [offlineQueue, setOfflineQueue] = useState<OfflineEvidenceDraft[]>([]);

  const canUpload = canUploadWorkOrderEvidence(currentUser?.role) && isEvidenceUploadEnabled(readiness);
  const canReview = canReviewWorkOrderEvidence(currentUser?.role);
  const canScanQr = canUploadWorkOrderEvidence(currentUser?.role);
  const canOverrideQr = canOverrideQrMismatch(currentUser?.role);
  const qrDone = isQrVerified(requirements?.qrVerificationStatus);
  const hasBeforePhoto = items.some((item) => item.evidenceType === "BEFORE_PHOTO" && item.status === "UPLOADED");

  useEffect(() => {
    // New evidence arrived (upload or refresh): move off Before once a before photo exists.
    if (hasBeforePhoto) {
      setEvidenceType((current) => (current === "BEFORE_PHOTO" ? "AFTER_PHOTO" : current));
    }
  }, [hasBeforePhoto]);
  const storageConfigured = isEvidenceUploadEnabled(readiness);

  useEffect(() => {
    setOfflineQueue(readOfflineEvidenceQueue().filter((item) => item.workOrderId === workOrderId));
  }, [workOrderId, items.length]);

  const groupedItems = useMemo(() => {
    const before = items.filter((item) => item.evidenceType === "BEFORE_PHOTO");
    const after = items.filter((item) => item.evidenceType === "AFTER_PHOTO");
    const documents = items.filter((item) =>
      ["INVOICE", "QUOTATION", "OTHER_DOCUMENT", "SIGNATURE", "DAMAGE_PHOTO", "PART_PHOTO"].includes(item.evidenceType)
    );
    const notes = items.filter((item) => ["TECHNICIAN_NOTE", "SUPERVISOR_NOTE"].includes(item.evidenceType));
    return { before, after, documents, notes };
  }, [items]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      if (!storageConfigured) {
        toast.error("File upload storage is not configured.");
        return;
      }

      if (readiness?.maxFileSizeMb && file.size > readiness.maxFileSizeMb * 1024 * 1024) {
        toast.error(`File exceeds the ${readiness.maxFileSizeMb} MB limit.`);
        return;
      }

      if (!canUpload && !isBrowserOnline()) {
        const clientGeneratedId = crypto.randomUUID();
        enqueueOfflineEvidenceDraft({
          clientGeneratedId,
          workOrderId,
          evidenceType,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          note: uploadNote.trim() || undefined
        });
        setOfflineQueue(readOfflineEvidenceQueue().filter((item) => item.workOrderId === workOrderId));
        toast.message("Offline draft saved. It will sync when online.");
        setPendingFile(null);
        return;
      }

      if (!canUpload) {
        return;
      }

      if (submitting) {
        return;
      }
      setSubmitting(true);
      setUploadPhase("uploading");
      try {
        // clientGeneratedId doubles as idempotency for upload-request retries on flaky mobile networks.
        const clientGeneratedId = crypto.randomUUID();
        const uploadResponse = await apiClient.post<ApiEnvelope<EvidenceUploadRequestResultLike>>(
          `/work-orders/${workOrderId}/evidence/upload-request`,
          {
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            evidenceType,
            note: uploadNote.trim() || undefined,
            clientGeneratedId
          }
        );
        const uploadResult = uploadResponse.data.data;

        if (!uploadResult.ok || !uploadResult.attachmentId || uploadResult.uploadMethod !== "direct") {
          setUploadPhase("failed");
          toast.error(uploadResult.message || "Photos upload is not available.");
          return;
        }

        await apiClient.post(
          `/work-orders/${workOrderId}/evidence/${uploadResult.attachmentId}/content`,
          await file.arrayBuffer(),
          {
            headers: { "Content-Type": "application/octet-stream" },
            transformRequest: [(data) => data]
          }
        );

        const confirmResponse = await apiClient.post<ApiEnvelope<{ ok: boolean; message: string }>>(
          `/work-orders/${workOrderId}/evidence/confirm`,
          { attachmentId: uploadResult.attachmentId }
        );

        if (!confirmResponse.data.data.ok) {
          setUploadPhase("failed");
          toast.error(confirmResponse.data.data.message || "Photos upload confirmation failed.");
          return;
        }

        setUploadPhase("idle");
        toast.success(`${evidenceTypeLabel(evidenceType)} uploaded.`);
        setEvidenceType(evidenceTypeAfterUpload(evidenceType));
        setUploadNote("");
        setPendingFile(null);
        await onRefresh?.();
      } catch (error) {
        setUploadPhase("failed");
        toast.error(getApiErrorMessage(error, "Photos upload failed."));
      } finally {
        setSubmitting(false);
      }
    },
    [canUpload, evidenceType, onRefresh, readiness?.maxFileSizeMb, storageConfigured, submitting, uploadNote, workOrderId]
  );

  /** Live camera photo: uploaded at once with the optional phone location. Keeps the preview on failure. */
  async function handleLivePhoto(capture: LiveCapture): Promise<boolean> {
    if (!canUpload || submitting) return false;
    setSubmitting(true);
    setUploadPhase("uploading");
    try {
      const location = await readCaptureLocation(5000);
      const result = await uploadWorkOrderFile({
        workOrderId,
        file: capture.blob,
        fileName: capture.fileName,
        mimeType: capture.mimeType,
        evidenceType,
        note: uploadNote,
        source: "LIVE_CAMERA",
        location
      });
      if (!result.ok) {
        setUploadPhase("failed");
        toast.error(result.message);
        return false;
      }
      setUploadPhase("idle");
      toast.success(`${evidenceTypeLabel(evidenceType)} uploaded.`);
      setEvidenceType(evidenceTypeAfterUpload(evidenceType));
      setUploadNote("");
      await onRefresh?.();
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  function retryOfflineDraft(draft: OfflineEvidenceDraft) {
    const blocked = offlineEvidenceRetryBlock();
    updateOfflineEvidenceDraft(draft.clientGeneratedId, {
      syncStatus: "FAILED",
      syncError: blocked.message
    });
    setOfflineQueue(readOfflineEvidenceQueue().filter((item) => item.workOrderId === workOrderId));
    toast.error(blocked.message);
    void draft;
  }

  /**
   * Camera scans call this straight away; typed values use the Verify button.
   * overrideReason is only sent by roles the API lets confirm a missing/damaged tag.
   */
  async function verifyQr(value?: string, overrideReason?: string) {
    const scannedValue = (value ?? qrInput).trim();
    if (!scannedValue) {
      setQrError("Scan the tag or type the vehicle number or asset tag.");
      return;
    }

    setSubmitting(true);
    setQrError(null);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/verify-qr`, {
        scannedAssetId: assetId ? scannedValue : undefined,
        scannedVehicleId: vehicleId ? scannedValue : undefined,
        overrideReason: overrideReason?.trim() || undefined
      });
      toast.success(overrideReason ? "Job confirmed without tag." : "Tag checked. This is the right asset.");
      setQrInput("");
      setQrMismatchValue(null);
      setQrOverrideReason("");
      await onRefresh?.();
    } catch (error) {
      const message = getApiErrorMessage(error, "QR check failed.");
      if (isQrMismatchMessage(message)) {
        setQrMismatchValue(scannedValue);
        setQrError("This tag is not for this job. Check you are at the right asset or vehicle.");
      } else {
        setQrError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function reviewEvidence(evidenceId: string, action: "accept" | "reject") {
    if (action === "reject" && rejectTargetId !== evidenceId) {
      setRejectTargetId(evidenceId);
      setRejectReason("");
      return;
    }

    setSubmitting(true);
    try {
      if (action === "accept") {
        await apiClient.post(`/work-orders/${workOrderId}/evidence/${evidenceId}/accept`, {});
        toast.success("Photos accepted.");
      } else {
        if (rejectReason.trim().length < 3) {
          toast.error("Rejection reason is required.");
          return;
        }
        await apiClient.post(`/work-orders/${workOrderId}/evidence/${evidenceId}/reject`, {
          reason: rejectReason.trim()
        });
        toast.error("Photos rejected. Needs to be fixed again.");
        setRejectTargetId(null);
        setRejectReason("");
      }
      await onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update photos review."));
    } finally {
      setSubmitting(false);
    }
  }

  function renderEvidenceList(list: WorkOrderEvidenceItem[], emptyLabel: string) {
    if (list.length === 0) {
      return <p className="text-xs text-slate-500">{emptyLabel}</p>;
    }

    return (
      <ul className="space-y-2">
        {list.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {item.mimeType.startsWith("image/") ? (
                    <Camera size={14} className="text-violet-600" aria-hidden="true" />
                  ) : (
                    <FileText size={14} className="text-slate-600" aria-hidden="true" />
                  )}
                  <p className="truncate text-sm font-medium text-slate-900">{evidenceTypeLabel(item.evidenceType)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.fileName} · {formatEvidenceFileSize(item.sizeBytes)} · {verificationStatusLabel(item.verificationStatus)}
                  {item.uploadedByName ? ` · ${item.uploadedByName}` : ""}
                </p>
                {item.note ? <p className="mt-1 text-xs text-slate-600">{item.note}</p> : null}
                {item.rejectedReason ? (
                  <p className="mt-1 text-xs text-red-700">{item.rejectedReason}</p>
                ) : null}
                {rejectTargetId === item.id ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      placeholder="Rejection reason (required)"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                        onClick={() => void reviewEvidence(item.id, "reject")}
                      >
                        Confirm reject
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                        onClick={() => setRejectTargetId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              {!readOnly && canReview && item.verificationStatus === "PENDING" && item.status === "UPLOADED" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void reviewEvidence(item.id, "accept")}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                  >
                    <CheckCircle2 size={12} /> Accept
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void reviewEvidence(item.id, "reject")}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700"
                  >
                    <XCircle size={12} /> Reject
                  </button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby="work-order-evidence-heading" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
          <Camera size={18} aria-hidden="true" />
          <span>Photos & field proof</span>
        </div>
        <h4 id="work-order-evidence-heading" className="mt-2 text-sm font-semibold text-slate-900">
          photos
        </h4>
        <p className="mt-1 text-xs text-slate-600">Before/after proof, QR verification, and supervisor review</p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-800">
          Before photo ({items.filter((item) => item.status === "UPLOADED" && item.evidenceType === "BEFORE_PHOTO").length})
        </span>
        <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-800">
          After photo ({items.filter((item) => item.status === "UPLOADED" && item.evidenceType === "AFTER_PHOTO").length})
        </span>
      </div>
      {items.some((item) => item.status === "UPLOADED" && item.mimeType.startsWith("image/")) ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items
            .filter((item) => item.status === "UPLOADED" && item.mimeType.startsWith("image/"))
            .map((item) => (
              <EvidenceThumb key={item.id} workOrderId={workOrderId} item={item} />
            ))}
        </div>
      ) : null}
      {items.some((item) => item.status === "UPLOADED" && item.mimeType === "application/pdf") ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="py-1 pr-3">File</th>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Uploaded by</th>
                <th className="py-1">Time</th>
              </tr>
            </thead>
            <tbody>
              {items
                .filter((item) => item.status === "UPLOADED" && item.mimeType === "application/pdf")
                .map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-2 pr-3">{item.fileName}</td>
                    <td className="py-2 pr-3">Document</td>
                    <td className="py-2 pr-3">{item.uploadedByName || "—"}</td>
                    <td className="py-2">{formatDrawerDateTime(item.createdAt)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {requirements ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Photos requirements checklist</p>
          <ul className="mt-2 space-y-1">
            <li>{requirements.hasBefore ? "✓" : "○"} Before photo ({requirements.beforeCount})</li>
            <li>{requirements.hasAfter ? "✓" : "○"} After photo ({requirements.afterCount})</li>
            <li>{requirements.completionNoteProvided ? "✓" : "○"} Technician completion note</li>
            {requirements.qrRequired ? (
              <li>
                {requirements.qrVerificationStatus === "VERIFIED" || requirements.qrVerificationStatus === "OVERRIDDEN"
                  ? "✓"
                  : "○"}{" "}
                QR tag: {qrStatusLabel(requirements.qrVerificationStatus)}
              </li>
            ) : null}
          </ul>
          {requirements.waived ? (
            <p className="mt-2 font-medium text-slate-700">photos waived while storage is off.</p>
          ) : !requirements.complete && requirements.required ? (
            <p className="mt-2 font-medium text-amber-800">Required photos missing.</p>
          ) : null}
          {requirements.rejectedCount > 0 ? (
            <p className="mt-1 font-medium text-red-700">Photos rejected. Needs to be fixed again.</p>
          ) : null}
        </div>
      ) : null}

      {readOnly ? null : (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-900">Upload photos</p>
        {!storageConfigured ? (
          <p className="mt-2 text-xs text-amber-800">
            Photo storage is not set up yet. Ask your administrator.
            {currentUser?.role === "ADMIN" || currentUser?.role === "SUPER_ADMIN"
              ? ` ${evidenceUploadDisabledMessage(readiness)}`
              : ""}
          </p>
        ) : null}
        {uploadPhase === "uploading" ? <p className="mt-2 text-xs text-slate-600">Uploading photos…</p> : null}
        {uploadPhase === "failed" ? (
          <p className="mt-2 text-xs text-red-700">Upload failed. Choose the file again to retry.</p>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Photo type">
          {(["BEFORE_PHOTO", "AFTER_PHOTO"] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={evidenceType === type}
              disabled={submitting}
              onClick={() => setEvidenceType(type)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                evidenceType === type
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              <Camera size={16} aria-hidden />
              {type === "BEFORE_PHOTO" ? "Add before photo" : "Add after photo"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Adding: <span className="font-semibold text-slate-900">{evidenceTypeLabel(evidenceType)}</span>
          {evidenceType === "BEFORE_PHOTO" && !hasBeforePhoto ? " (take it before you start the repair)" : ""}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Other file (invoice, part photo...)
            <select
              value={evidenceType === "BEFORE_PHOTO" || evidenceType === "AFTER_PHOTO" ? "" : evidenceType}
              onChange={(event) => setEvidenceType(event.target.value || defaultEvidenceType(items))}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              <option value="">Not needed</option>
              {EVIDENCE_TYPE_OPTIONS.filter((option) => option.value !== "BEFORE_PHOTO" && option.value !== "AFTER_PHOTO").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Note (optional)
            <input
              value={uploadNote}
              onChange={(event) => setUploadNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 space-y-3">
          {isLivePhotoEvidenceType(evidenceType) ? (
            <LiveCameraCapture
              key={evidenceType}
              captureLabel={`Take ${evidenceTypeLabel(evidenceType).toLowerCase()}`}
              useLabel={`Upload ${evidenceTypeLabel(evidenceType).toLowerCase()}`}
              disabled={!canUpload || !isBrowserOnline()}
              busy={submitting}
              onUse={(capture) => handleLivePhoto(capture)}
            />
          ) : (
          <>
          <EvidencePicker
            disabled={submitting || (!canUpload && isBrowserOnline())}
            accept={(readiness?.allowedMimeTypes ?? []).join(",") || undefined}
            maxBytes={(readiness?.maxFileSizeMb ?? 15) * 1024 * 1024}
            helperText={
              readiness
                ? `${formatAllowedEvidenceMimeTypes(readiness.allowedMimeTypes)} · Max ${readiness.maxFileSizeMb} MB`
                : undefined
            }
            onInvalid={(message) => toast.error(message)}
            onFileChange={setPendingFile}
          />
          <button
            type="button"
            disabled={submitting || !pendingFile || (!canUpload && isBrowserOnline())}
            onClick={() => {
              if (pendingFile?.file) {
                void handleFileSelected(pendingFile.file);
              }
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {isBrowserOnline() ? `Upload ${evidenceTypeLabel(evidenceType).toLowerCase()}` : "Save to send later"}
          </button>
          </>
          )}
          {isLivePhotoEvidenceType(evidenceType) && !isBrowserOnline() ? (
            <p className="text-xs text-amber-800">You are offline. Photos are sent straight away, so connect to the internet first.</p>
          ) : null}
        </div>
      </div>
      )}

      {(assetId || vehicleId) && requirements?.qrRequired ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <QrCode size={16} /> QR tag check
          </div>
          <p
            className={`mt-2 inline-flex items-center gap-1 text-sm font-medium ${qrDone ? "text-emerald-700" : "text-amber-800"}`}
            role="status"
          >
            {qrDone ? <CheckCircle2 size={14} aria-hidden /> : null}
            {qrStatusLabel(requirements.qrVerificationStatus)}
          </p>
          {readOnly || qrDone ? null : !canScanQr ? (
            <p className="mt-1 text-xs text-slate-600">The assigned technician scans the tag.</p>
          ) : (
            <>
              <p className="mt-1 text-xs text-slate-600">Scan the tag to confirm you are at the right asset or vehicle.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setQrScannerOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <Camera size={16} aria-hidden />
                  Scan with camera
                </button>
                <input
                  value={qrInput}
                  onChange={(event) => {
                    setQrInput(event.target.value);
                    setQrError(null);
                  }}
                  placeholder="Vehicle number or asset tag"
                  aria-label="Vehicle number or asset tag"
                  className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm sm:min-w-[200px]"
                />
                <button
                  type="button"
                  disabled={submitting || !qrInput.trim()}
                  onClick={() => void verifyQr()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
                  Verify
                </button>
              </div>
              {qrError ? (
                <p className="mt-2 text-sm text-red-700" role="alert">
                  {qrError}
                </p>
              ) : null}
              {qrMismatchValue ? (
                canOverrideQr ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-950">Tag missing or damaged?</p>
                    <p className="mt-1 text-xs text-amber-900">If you checked the asset yourself, write why and confirm.</p>
                    <input
                      value={qrOverrideReason}
                      onChange={(event) => setQrOverrideReason(event.target.value)}
                      placeholder="Reason, e.g. tag broken, checked plate number"
                      aria-label="Reason to confirm without tag"
                      className="mt-2 min-h-11 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={submitting || qrOverrideReason.trim().length < QR_OVERRIDE_MIN_REASON}
                      onClick={() => void verifyQr(qrMismatchValue, qrOverrideReason)}
                      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                      Confirm without tag
                    </button>
                    {qrOverrideReason.trim().length < QR_OVERRIDE_MIN_REASON ? (
                      <p className="mt-1 text-xs text-amber-900">Write at least {QR_OVERRIDE_MIN_REASON} letters.</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-medium text-amber-900">Ask a manager to confirm this job.</p>
                )
              ) : null}
            </>
          )}
          <QrScanner
            open={qrScannerOpen}
            onClose={() => setQrScannerOpen(false)}
            title="Scan asset or vehicle tag"
            onScan={(value) => {
              setQrScannerOpen(false);
              setQrInput(value);
              // A camera scan checks straight away. No extra button press.
              void verifyQr(value);
            }}
          />
        </div>
      ) : null}

      {offlineQueue.length > 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <WifiOff size={16} /> Offline sync queue
          </div>
          <ul className="mt-2 space-y-2">
            {offlineQueue.map((draft) => (
              <li key={draft.clientGeneratedId} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  {evidenceTypeLabel(draft.evidenceType)} · {draft.fileName} · {draft.syncStatus}
                  {draft.syncError ? ` — ${draft.syncError}` : ""}
                </span>
                {draft.syncStatus === "FAILED" || draft.syncStatus === "PENDING" ? (
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1"
                    onClick={() => void retryOfflineDraft(draft)}
                  >
                    Retry sync
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading photos…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before photos</h5>
            <div className="mt-2">{renderEvidenceList(groupedItems.before, "No before photos yet.")}</div>
          </div>
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">After photos</h5>
            <div className="mt-2">{renderEvidenceList(groupedItems.after, "No after photos yet.")}</div>
          </div>
          <div className="lg:col-span-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Documents & notes</h5>
            <div className="mt-2">
              {renderEvidenceList([...groupedItems.documents, ...groupedItems.notes], "No documents or notes yet.")}
            </div>
          </div>
        </div>
      )}

      {evidencePayloadHasSecrets({ items, readiness }) ? (
        <p className="text-xs font-medium text-red-700">Unexpected secret-like fields detected in photos data.</p>
      ) : null}
    </section>
  );
}

export type { WorkOrderEvidenceListResponse };
