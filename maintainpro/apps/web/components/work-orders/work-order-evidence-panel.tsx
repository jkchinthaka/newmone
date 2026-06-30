"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  canUploadWorkOrderEvidence,
  evidencePayloadHasSecrets,
  evidenceUploadDisabledMessage,
  formatAllowedEvidenceMimeTypes,
  formatEvidenceFileSize,
  isEvidenceUploadEnabled,
  type EvidenceStorageReadiness,
  type WorkOrderEvidenceItem,
  type WorkOrderEvidenceListResponse
} from "@/lib/work-order-evidence";

type ApiEnvelope<T> = {
  data: T;
  message?: string;
};

type WorkOrderEvidencePanelProps = {
  workOrderId: string;
  readiness: EvidenceStorageReadiness | null;
  items: WorkOrderEvidenceItem[];
  loading?: boolean;
  onRefresh?: () => Promise<void> | void;
};

export function WorkOrderEvidencePanel({
  workOrderId,
  readiness,
  items,
  loading = false,
  onRefresh
}: WorkOrderEvidencePanelProps) {
  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canUpload = canUploadWorkOrderEvidence(currentUser?.role) && isEvidenceUploadEnabled(readiness);

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !canUpload) {
        return;
      }

      setSubmitting(true);
      try {
        const uploadResponse = await apiClient.post<ApiEnvelope<EvidenceUploadRequestResultLike>>(
          `/work-orders/${workOrderId}/evidence/upload-request`,
          {
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size
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

        toast.success("Evidence metadata recorded.");
        await onRefresh?.();
      } catch (error) {
        toast.error(getApiErrorMessage(error, "Evidence upload failed."));
      } finally {
        setSubmitting(false);
      }
    },
    [canUpload, onRefresh, workOrderId]
  );

  return (
    <section
      aria-labelledby="work-order-evidence-heading"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-brand-700">
            <Camera size={18} aria-hidden="true" />
            <span>Evidence attachments</span>
          </div>
          <h4 id="work-order-evidence-heading" className="mt-2 text-sm font-semibold text-slate-900">
            Photos and documents
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Upload before/after photos, completion notes, or invoice documents when storage is enabled. This release
            records attachment metadata only; binary storage depends on your configured evidence provider.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Before photo</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">After photo</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Completion note</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">Invoice / document</span>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept={(readiness?.allowedMimeTypes ?? []).join(",")}
            className="sr-only"
            aria-label="Upload evidence file"
            disabled={!canUpload || submitting}
            onChange={(event) => void handleFileSelected(event)}
          />
          <button
            type="button"
            disabled={!canUpload || submitting}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Upload evidence
          </button>
          {!canUpload ? (
            <p className="max-w-xs text-right text-xs text-slate-500">{evidenceUploadDisabledMessage(readiness)}</p>
          ) : null}
        </div>
      </div>

      {readiness ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            Allowed: {formatAllowedEvidenceMimeTypes(readiness.allowedMimeTypes)} · Max{" "}
            {readiness.maxFileSizeMb} MB · Mode {readiness.mode} ({readiness.state})
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading evidence…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No evidence attachments yet.</p>
      ) : (
        <ul className="mt-4 space-y-2" aria-label="Work order evidence attachments">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {item.mimeType.startsWith("image/") ? (
                    <Camera size={14} className="text-violet-600" aria-hidden="true" />
                  ) : (
                    <FileText size={14} className="text-slate-600" aria-hidden="true" />
                  )}
                  <p className="truncate text-sm font-medium text-slate-900">{item.fileName}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {item.mimeType} · {formatEvidenceFileSize(item.sizeBytes)} · {item.status}
                  {item.uploadedByName ? ` · ${item.uploadedByName}` : ""}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                {item.downloadAvailable ? "Download pending provider UAT" : "Metadata only"}
              </p>
            </li>
          ))}
        </ul>
      )}

      {evidencePayloadHasSecrets({ items, readiness }) ? (
        <p className="mt-3 text-xs font-medium text-red-700">Unexpected secret-like fields detected in evidence data.</p>
      ) : null}
    </section>
  );
}

type EvidenceUploadRequestResultLike = {
  ok: boolean;
  attachmentId?: string;
  message?: string;
};

type WorkOrderEvidenceListResponseExport = WorkOrderEvidenceListResponse;

export type { WorkOrderEvidenceListResponseExport as WorkOrderEvidenceListResponse };
