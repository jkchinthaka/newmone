"use client";

import QRCode from "react-qr-code";
import { Copy, QrCode, X } from "lucide-react";
import { toast } from "sonner";

import {
  buildQrIssueReportAbsoluteUrl,
  createQrIssueReportPayload,
  type QrIssueReportEntityType
} from "@/lib/qr-issue-reporting";

type FacilityQrIssueLinkDialogProps = {
  open: boolean;
  onClose: () => void;
  entityType: QrIssueReportEntityType;
  entityId: string;
  entityName: string;
};

export function FacilityQrIssueLinkDialog({
  open,
  onClose,
  entityType,
  entityId,
  entityName
}: FacilityQrIssueLinkDialogProps) {
  if (!open) {
    return null;
  }

  const payload = createQrIssueReportPayload({
    type: entityType,
    entityId,
    label: entityName
  });
  const reportUrl =
    typeof window !== "undefined"
      ? buildQrIssueReportAbsoluteUrl(window.location.origin, payload)
      : buildQrIssueReportAbsoluteUrl("https://app.example.com", payload);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl);
      toast.success("QR issue link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="facility-qr-issue-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="facility-qr-issue-title" className="text-lg font-semibold text-slate-900">
              QR issue report link
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Authenticated users can scan or open this link to report an issue for{" "}
              <span className="font-medium">{entityName}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <QRCode value={reportUrl} size={160} />
          <p className="text-center text-xs text-slate-500">
            Sign-in required. No auth tokens are encoded in this QR payload.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Report URL
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={reportUrl}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
            />
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Copy size={14} aria-hidden="true" />
              Copy
            </button>
          </div>
        </div>

        {entityType !== "room" ? (
          <p className="mt-3 text-xs text-amber-700">
            This link prefills {entityType} context only. The reporter must still choose a room before submitting.
          </p>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function FacilityQrIssueLinkButton({
  entityType,
  entityId,
  entityName,
  onOpen
}: {
  entityType: QrIssueReportEntityType;
  entityId: string;
  entityName: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`QR issue link for ${entityName}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
      title="QR issue report link"
    >
      <QrCode size={16} aria-hidden="true" />
    </button>
  );
}
