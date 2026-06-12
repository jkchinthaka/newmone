"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldX,
  Trash2,
  XCircle
} from "lucide-react";
import Link from "next/link";

import {
  COMPLIANCE_BADGE,
  DOCUMENT_STATUS_BADGE,
  VEHICLE_DOCUMENT_TYPES,
  formatDate,
  p4Delete,
  p4Get,
  p4Post,
  type ComplianceStatus,
  type VehicleDocumentType
} from "@/lib/phase4-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredPermissions } from "@/lib/user-role";
import { useConfirmDialog } from "@/components/ui/use-confirm-dialog";
import { usePromptDialog } from "@/components/ui/use-prompt-dialog";

interface VehicleDocument {
  id: string;
  vehicleId: string;
  documentType: VehicleDocumentType;
  documentNumber?: string | null;
  issuedDate?: string | null;
  expiryDate: string;
  issuingAuthority?: string | null;
  status: keyof typeof DOCUMENT_STATUS_BADGE | string;
  rejectionReason?: string | null;
  verifiedAt?: string | null;
  fileUrl?: string | null;
  notes?: string | null;
}

interface ComplianceDetail {
  vehicleId: string;
  status: ComplianceStatus;
  reasons: string[];
  details: Array<{
    documentType: VehicleDocumentType;
    state: string;
    expiryDate?: string | null;
    daysUntilExpiry?: number;
  }>;
}

interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  vehicleModel: string;
}

export default function VehicleDocumentsPage({
  params
}: {
  params: { id: string };
}) {
  const vehicleId = params.id;
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { prompt, dialog: promptDialog } = usePromptDialog();
  const [docs, setDocs] = useState<VehicleDocument[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [compliance, setCompliance] = useState<ComplianceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canManage = permissions.has("vehicle_documents.manage");
  const canVerify = permissions.has("vehicle_documents.verify");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [list, vehicleRes, comp] = await Promise.all([
        p4Get<VehicleDocument[]>(`/vehicles/${vehicleId}/documents`),
        p4Get<Vehicle>(`/vehicles/${vehicleId}`).catch(() => null),
        p4Get<ComplianceDetail>(`/compliance/vehicles/${vehicleId}`).catch(() => null)
      ]);
      setDocs(list);
      setVehicle(vehicleRes);
      setCompliance(comp);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load vehicle documents"));
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onVerify = async (id: string) => {
    try {
      await p4Post(`/vehicle-documents/${id}/verify`);
      toast.success("Document verified");
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to verify document"));
    }
  };

  const onReject = async (id: string) => {
    const reason = await prompt({
      title: "Reject document?",
      description: "Provide a reason so the submitter knows what to fix.",
      label: "Reason for rejection",
      placeholder: "e.g. Expiry date is unclear on the uploaded file",
      submitLabel: "Reject document",
      cancelLabel: "Keep document",
      required: true,
      requiredMessage: "A rejection reason is required."
    });
    if (!reason) return;
    try {
      await p4Post(`/vehicle-documents/${id}/reject`, { reason });
      toast.success("Document rejected");
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to reject document"));
    }
  };

  const onRemove = async (id: string) => {
    const confirmed = await confirm({
      title: "Delete document?",
      description: "This document will be permanently removed from the vehicle record.",
      confirmLabel: "Delete document",
      cancelLabel: "Keep document",
      variant: "destructive"
    });
    if (!confirmed) return;
    try {
      await p4Delete(`/vehicle-documents/${id}`);
      toast.success("Document deleted");
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to delete document"));
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/vehicles/${vehicleId}` as never}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft size={12} /> Back to vehicle
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">
            Vehicle Documents
          </h1>
          <p className="text-sm text-slate-600">
            {vehicle ? `${vehicle.registrationNo} — ${vehicle.make} ${vehicle.vehicleModel}` : vehicleId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compliance ? (
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium ${
                COMPLIANCE_BADGE[compliance.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {compliance.status === "COMPLIANT" ? <CheckCircle2 size={12} /> : <ShieldX size={12} />}
              {compliance.status.replace(/_/g, " ")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={14} /> Upload Document
            </button>
          ) : null}
        </div>
      </header>

      {compliance && compliance.reasons.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="font-semibold">Compliance findings</p>
          <ul className="ml-5 list-disc">
            {compliance.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <FileText size={14} /> Documents
          </h2>
          <span className="text-xs text-slate-500">{docs.length} document(s)</span>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Number</th>
                <th className="px-4 py-2 text-left">Issued</th>
                <th className="px-4 py-2 text-left">Expiry</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">File</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading..." : "No documents uploaded yet."}
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-900">{doc.documentType}</td>
                    <td className="px-4 py-2 text-slate-700">{doc.documentNumber ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(doc.issuedDate)}</td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(doc.expiryDate)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                          DOCUMENT_STATUS_BADGE[doc.status] ?? "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {doc.status}
                      </span>
                      {doc.rejectionReason ? (
                        <p className="mt-1 text-[11px] text-rose-600">{doc.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {doc.fileUrl ? (
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        {canVerify && doc.status === "PENDING_VERIFICATION" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onVerify(doc.id)}
                              className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                            >
                              <CheckCircle2 size={12} /> Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => onReject(doc.id)}
                              className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
                            >
                              <XCircle size={12} /> Reject
                            </button>
                          </>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => onRemove(doc.id)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <CreateDocumentDialog
          vehicleId={vehicleId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      ) : null}
      {confirmDialog}
      {promptDialog}
    </div>
  );
}

function CreateDocumentDialog({
  vehicleId,
  onClose,
  onSaved
}: {
  vehicleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [documentType, setDocumentType] = useState<VehicleDocumentType>("REGISTRATION");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!expiryDate) {
      toast.error("Expiry date is required");
      return;
    }
    setSaving(true);
    try {
      await p4Post(`/vehicles/${vehicleId}/documents`, {
        documentType,
        documentNumber: documentNumber || undefined,
        issuedDate: issuedDate || undefined,
        expiryDate,
        issuingAuthority: issuingAuthority || undefined,
        fileUrl: fileUrl || undefined,
        notes: notes || undefined
      });
      toast.success("Document uploaded");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to upload document"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h3 className="text-base font-semibold text-slate-900">Upload Vehicle Document</h3>
        <Field label="Document type">
          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as VehicleDocumentType)}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          >
            {VEHICLE_DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Document number">
            <input
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Issuing authority">
            <input
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Issued date">
            <input
              type="date"
              value={issuedDate}
              onChange={(e) => setIssuedDate(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Expiry date *">
            <input
              type="date"
              required
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <Field label="File URL">
          <input
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            rows={2}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Upload
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
