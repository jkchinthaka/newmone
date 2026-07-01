"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle2, FileText, Loader2, QrCode, UploadCloud, WifiOff, XCircle } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  enqueueOfflineEvidenceDraft,
  isBrowserOnline,
  readOfflineEvidenceQueue,
  type OfflineEvidenceDraft,
  updateOfflineEvidenceDraft
} from "@/lib/work-order-evidence-offline";
import {
  canReviewWorkOrderEvidence,
  canUploadWorkOrderEvidence,
  EVIDENCE_TYPE_OPTIONS,
  evidencePayloadHasSecrets,
  evidenceTypeLabel,
  evidenceUploadDisabledMessage,
  formatAllowedEvidenceMimeTypes,
  formatEvidenceFileSize,
  isEvidenceUploadEnabled,
  verificationStatusLabel,
  type EvidenceStorageReadiness,
  type WorkOrderEvidenceItem,
  type WorkOrderEvidenceListResponse,
  type WorkOrderEvidenceRequirements
} from "@/lib/work-order-evidence";

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
};

type EvidenceUploadRequestResultLike = {
  ok: boolean;
  attachmentId?: string;
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
  onRefresh
}: WorkOrderEvidencePanelProps) {
  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceType, setEvidenceType] = useState("BEFORE_PHOTO");
  const [uploadNote, setUploadNote] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [offlineQueue, setOfflineQueue] = useState<OfflineEvidenceDraft[]>([]);

  const canUpload = canUploadWorkOrderEvidence(currentUser?.role) && isEvidenceUploadEnabled(readiness);
  const canReview = canReviewWorkOrderEvidence(currentUser?.role);
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
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!storageConfigured) {
        toast.error("File upload storage is not configured.");
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
        return;
      }

      if (!canUpload) {
        return;
      }

      setSubmitting(true);
      try {
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

        if (!uploadResult.ok || !uploadResult.attachmentId) {
          toast.error(uploadResult.message || "Evidence upload is not available.");
          return;
        }

        const confirmResponse = await apiClient.post<ApiEnvelope<{ ok: boolean; message: string }>>(
          `/work-orders/${workOrderId}/evidence/confirm`,
          { attachmentId: uploadResult.attachmentId }
        );

        if (!confirmResponse.data.data.ok) {
          toast.error(confirmResponse.data.data.message || "Evidence upload confirmation failed.");
          return;
        }

        toast.success("Evidence recorded.");
        setUploadNote("");
        await onRefresh?.();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Evidence upload failed."));
      } finally {
        setSubmitting(false);
      }
    },
    [canUpload, evidenceType, onRefresh, storageConfigured, uploadNote, workOrderId]
  );

  async function retryOfflineDraft(draft: OfflineEvidenceDraft) {
    if (!isBrowserOnline() || !storageConfigured) {
      toast.error("Connect and configure storage before retrying sync.");
      return;
    }

    updateOfflineEvidenceDraft(draft.clientGeneratedId, { syncStatus: "SYNCING" });
    setOfflineQueue(readOfflineEvidenceQueue().filter((item) => item.workOrderId === workOrderId));

    try {
      const uploadResponse = await apiClient.post<ApiEnvelope<EvidenceUploadRequestResultLike>>(
        `/work-orders/${workOrderId}/evidence/upload-request`,
        {
          fileName: draft.fileName,
          mimeType: draft.mimeType,
          sizeBytes: draft.sizeBytes,
          evidenceType: draft.evidenceType,
          note: draft.note,
          source: "OFFLINE_SYNC",
          clientGeneratedId: draft.clientGeneratedId
        }
      );
      const uploadResult = uploadResponse.data.data;
      if (!uploadResult.ok || !uploadResult.attachmentId) {
        throw new Error(uploadResult.message || "Sync failed");
      }
      await apiClient.post(`/work-orders/${workOrderId}/evidence/confirm`, {
        attachmentId: uploadResult.attachmentId
      });
      updateOfflineEvidenceDraft(draft.clientGeneratedId, { syncStatus: "SYNCED" });
      toast.success("Offline evidence synced.");
      await onRefresh?.();
    } catch (error) {
      updateOfflineEvidenceDraft(draft.clientGeneratedId, {
        syncStatus: "FAILED",
        syncError: getApiErrorMessage(error, "Sync failed")
      });
      toast.error(getApiErrorMessage(error, "Offline sync failed."));
    } finally {
      setOfflineQueue(readOfflineEvidenceQueue().filter((item) => item.workOrderId === workOrderId));
    }
  }

  async function verifyQr() {
    const scannedValue = qrInput.trim();
    if (!scannedValue) {
      toast.error("Scan or enter an asset/vehicle ID.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/work-orders/${workOrderId}/verify-qr`, {
        scannedAssetId: assetId ? scannedValue : undefined,
        scannedVehicleId: vehicleId ? scannedValue : undefined
      });
      toast.success("QR verification completed.");
      setQrInput("");
      await onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "QR verification failed."));
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
        toast.success("Evidence accepted.");
      } else {
        if (rejectReason.trim().length < 3) {
          toast.error("Rejection reason is required.");
          return;
        }
        await apiClient.post(`/work-orders/${workOrderId}/evidence/${evidenceId}/reject`, {
          reason: rejectReason.trim()
        });
        toast.error("Evidence rejected. Rework required.");
        setRejectTargetId(null);
        setRejectReason("");
      }
      await onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update evidence review."));
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
              {canReview && item.verificationStatus === "PENDING" && item.status === "UPLOADED" ? (
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
          <span>Evidence & field proof</span>
        </div>
        <h4 id="work-order-evidence-heading" className="mt-2 text-sm font-semibold text-slate-900">
          Before/after proof, QR verification, and supervisor review
        </h4>
      </div>

      {requirements ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-medium text-slate-900">Evidence requirements checklist</p>
          <ul className="mt-2 space-y-1">
            <li>{requirements.hasBefore ? "✓" : "○"} Before photo ({requirements.beforeCount})</li>
            <li>{requirements.hasAfter ? "✓" : "○"} After photo ({requirements.afterCount})</li>
            <li>{requirements.completionNoteProvided ? "✓" : "○"} Technician completion note</li>
            {requirements.qrRequired ? (
              <li>
                {requirements.qrVerificationStatus === "VERIFIED" || requirements.qrVerificationStatus === "OVERRIDDEN"
                  ? "✓"
                  : "○"}{" "}
                QR verification ({requirements.qrVerificationStatus})
              </li>
            ) : null}
          </ul>
          {!requirements.complete && requirements.required ? (
            <p className="mt-2 font-medium text-amber-800">Required evidence missing.</p>
          ) : null}
          {requirements.rejectedCount > 0 ? (
            <p className="mt-1 font-medium text-red-700">Evidence rejected. Rework required.</p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm font-medium text-slate-900">Upload evidence</p>
        {!storageConfigured ? (
          <p className="mt-2 text-xs text-amber-800">{evidenceUploadDisabledMessage(readiness)}</p>
        ) : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-600">
            Evidence type
            <select
              value={evidenceType}
              onChange={(event) => setEvidenceType(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            >
              {EVIDENCE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600 sm:col-span-2">
            Note (optional)
            <input
              value={uploadNote}
              onChange={(event) => setUploadNote(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={(readiness?.allowedMimeTypes ?? []).join(",")}
            className="sr-only"
            aria-label="Upload evidence file"
            disabled={submitting}
            onChange={(event) => void handleFileSelected(event)}
          />
          <button
            type="button"
            disabled={submitting || (!canUpload && isBrowserOnline())}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Upload file
          </button>
          {readiness ? (
            <span className="text-xs text-slate-500">
              {formatAllowedEvidenceMimeTypes(readiness.allowedMimeTypes)} · Max {readiness.maxFileSizeMb} MB
            </span>
          ) : null}
        </div>
      </div>

      {(assetId || vehicleId) && requirements?.qrRequired ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <QrCode size={16} /> QR verification
          </div>
          <p className="mt-1 text-xs text-slate-600">Confirm you are working on the correct asset or vehicle.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={qrInput}
              onChange={(event) => setQrInput(event.target.value)}
              placeholder={assetId ? "Scanned asset ID" : "Scanned vehicle ID"}
              className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={submitting}
              onClick={() => void verifyQr()}
              className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Verify scan
            </button>
          </div>
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
          Loading evidence…
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
        <p className="text-xs font-medium text-red-700">Unexpected secret-like fields detected in evidence data.</p>
      ) : null}
    </section>
  );
}

export type { WorkOrderEvidenceListResponse };
