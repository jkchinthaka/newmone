"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Wrench } from "lucide-react";

import {
  FINE_PAYMENT_STATUS,
  FINE_RESPONSIBILITY,
  formatCurrency,
  formatDate,
  p4Get,
  p4Post,
  type FinePaymentStatus,
  type FineResponsibility
} from "@/lib/phase4-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredPermissions } from "@/lib/user-role";

interface FineRow {
  id: string;
  fineNumber: string;
  vehicleId: string;
  driverId?: string | null;
  fineDate: string;
  dueDate?: string | null;
  location?: string | null;
  description: string;
  violationCode?: string | null;
  fineAmount: number;
  responsibility?: FineResponsibility | null;
  documentRelated?: boolean | null;
  paymentStatus: FinePaymentStatus;
  paidAmount?: number | null;
  paidAt?: string | null;
  vehicle?: { registrationNo: string };
  workOrder?: { id: string; workOrderNumber: string } | null;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  DISPUTED: "bg-rose-100 text-rose-700",
  OVERDUE: "bg-rose-200 text-rose-800",
  WAIVED: "bg-slate-100 text-slate-700"
};

const RESPONSIBILITY_BADGE: Record<string, string> = {
  DRIVER: "bg-rose-50 text-rose-700",
  ORGANIZATION: "bg-blue-50 text-blue-700",
  VEHICLE_DEFECT: "bg-amber-50 text-amber-700",
  UNDETERMINED: "bg-slate-100 text-slate-700"
};

export default function TrafficFinesPage() {
  const [rows, setRows] = useState<FineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [active, setActive] = useState<FineRow | null>(null);
  const [filter, setFilter] = useState<{
    vehicleId?: string;
    driverId?: string;
    paymentStatus?: string;
    responsibility?: string;
  }>({});

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canReport = permissions.has("traffic_fines.report");
  const canManage = permissions.has("traffic_fines.manage");
  const canPayment = permissions.has("traffic_fines.payment");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await p4Get<FineRow[]>("/traffic-fines", filter);
      setRows(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load traffic fines"));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Traffic Fines</h1>
          <p className="text-sm text-slate-600">
            Record traffic violations and classify responsibility based on vehicle document validity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter.paymentStatus ?? ""}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, paymentStatus: e.target.value || undefined }))
            }
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="">All payment statuses</option>
            {FINE_PAYMENT_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={filter.responsibility ?? ""}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, responsibility: e.target.value || undefined }))
            }
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="">All responsibility</option>
            {FINE_RESPONSIBILITY.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {canReport ? (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={14} /> Report Fine
            </button>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Fine</th>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Offense</th>
                <th className="px-4 py-2 text-left">Responsibility</th>
                <th className="px-4 py-2 text-left">Payment</th>
                <th className="px-4 py-2 text-left">WO</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading..." : "No fines recorded."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setActive(row)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{row.fineNumber}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.vehicle?.registrationNo ?? row.vehicleId}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(row.fineDate)}</td>
                    <td className="px-4 py-2 text-slate-700">{row.description}</td>
                    <td className="px-4 py-2">
                      {row.responsibility ? (
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                            RESPONSIBILITY_BADGE[row.responsibility] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {row.responsibility}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[row.paymentStatus] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.workOrder ? row.workOrder.workOrderNumber : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {formatCurrency(row.fineAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <CreateFineDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      ) : null}

      {active ? (
        <FineDetailDialog
          fine={active}
          canManage={canManage}
          canPayment={canPayment}
          onClose={() => setActive(null)}
          onSaved={() => {
            setActive(null);
            refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateFineDialog({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vehicleId: "",
    driverId: "",
    fineDate: "",
    dueDate: "",
    offense: "",
    violationCode: "",
    location: "",
    fineAmount: "",
    responsibility: "",
    documentRelated: false,
    relatedDocumentType: "",
    issuingAuthority: "",
    evidenceUrls: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await p4Post("/traffic-fines", {
        vehicleId: form.vehicleId.trim(),
        driverId: form.driverId.trim() || undefined,
        fineDate: form.fineDate,
        dueDate: form.dueDate || undefined,
        offense: form.offense.trim(),
        violationCode: form.violationCode.trim() || undefined,
        location: form.location.trim() || undefined,
        fineAmount: Number(form.fineAmount),
        responsibility: form.responsibility || undefined,
        documentRelated: form.documentRelated,
        relatedDocumentType: form.relatedDocumentType.trim() || undefined,
        issuingAuthority: form.issuingAuthority.trim() || undefined,
        evidenceUrls: form.evidenceUrls
          ? form.evidenceUrls
              .split(/\r?\n|,/)
              .map((u) => u.trim())
              .filter(Boolean)
          : undefined,
        notes: form.notes.trim() || undefined
      });
      toast.success("Traffic fine recorded");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to record fine"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Report Traffic Fine" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle ID *">
            <input
              required
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Driver ID">
            <input
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Fine date *">
            <input
              required
              type="date"
              value={form.fineDate}
              onChange={(e) => setForm({ ...form, fineDate: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <Field label="Offense *">
          <input
            required
            value={form.offense}
            onChange={(e) => setForm({ ...form, offense: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Violation code">
            <input
              value={form.violationCode}
              onChange={(e) => setForm({ ...form, violationCode: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Issuing authority">
            <input
              value={form.issuingAuthority}
              onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Fine amount *">
            <input
              required
              type="number"
              value={form.fineAmount}
              onChange={(e) => setForm({ ...form, fineAmount: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Responsibility (override)">
            <select
              value={form.responsibility}
              onChange={(e) => setForm({ ...form, responsibility: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            >
              <option value="">Auto-classify</option>
              {FINE_RESPONSIBILITY.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Related document type">
            <input
              value={form.relatedDocumentType}
              onChange={(e) => setForm({ ...form, relatedDocumentType: e.target.value })}
              placeholder="e.g. INSURANCE, FITNESS"
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.documentRelated}
            onChange={(e) => setForm({ ...form, documentRelated: e.target.checked })}
          />
          Document related fine (auto-classify by validity on fine date)
        </label>
        <Field label="Evidence URLs (one per line)">
          <textarea
            rows={2}
            value={form.evidenceUrls}
            onChange={(e) => setForm({ ...form, evidenceUrls: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <FormActions saving={saving} onClose={onClose} label="Record" />
      </form>
    </Modal>
  );
}

function FineDetailDialog({
  fine,
  canManage,
  canPayment,
  onClose,
  onSaved
}: {
  fine: FineRow;
  canManage: boolean;
  canPayment: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [resp, setResp] = useState<FineResponsibility>(fine.responsibility ?? "UNDETERMINED");
  const [respReason, setRespReason] = useState("");
  const [payStatus, setPayStatus] = useState<FinePaymentStatus>(fine.paymentStatus);
  const [paidAmount, setPaidAmount] = useState(fine.paidAmount ? String(fine.paidAmount) : "");
  const [paymentRef, setPaymentRef] = useState("");
  const [busy, setBusy] = useState(false);

  const updateResponsibility = async () => {
    if (!canManage) return;
    setBusy(true);
    try {
      await p4Post(`/traffic-fines/${fine.id}/responsibility`, {
        responsibility: resp,
        reason: respReason.trim() || undefined
      });
      toast.success("Responsibility updated");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update"));
    } finally {
      setBusy(false);
    }
  };

  const updatePayment = async () => {
    if (!canPayment) return;
    setBusy(true);
    try {
      await p4Post(`/traffic-fines/${fine.id}/payment`, {
        status: payStatus,
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        paymentReference: paymentRef.trim() || undefined,
        paidAt: payStatus === "PAID" ? new Date().toISOString() : undefined
      });
      toast.success("Payment updated");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update payment"));
    } finally {
      setBusy(false);
    }
  };

  const linkWorkOrder = async () => {
    setBusy(true);
    try {
      await p4Post(`/traffic-fines/${fine.id}/work-order`, {});
      toast.success("Work order linked");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to link work order"));
    } finally {
      setBusy(false);
    }
  };

  const isVehicleDefect = (fine.responsibility ?? resp) === "VEHICLE_DEFECT";

  return (
    <Modal title={`Fine ${fine.fineNumber}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Vehicle">{fine.vehicle?.registrationNo ?? fine.vehicleId}</Info>
        <Info label="Fine date">{formatDate(fine.fineDate)}</Info>
        <Info label="Due date">{formatDate(fine.dueDate)}</Info>
        <Info label="Amount">{formatCurrency(fine.fineAmount)}</Info>
        <Info label="Offense">{fine.description}</Info>
        <Info label="Violation code">{fine.violationCode ?? "—"}</Info>
        <Info label="Responsibility">{fine.responsibility ?? "—"}</Info>
        <Info label="Payment status">{fine.paymentStatus}</Info>
      </div>

      {canManage ? (
        <section className="mt-4 space-y-2 rounded border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Update responsibility</p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={resp}
              onChange={(e) => setResp(e.target.value as FineResponsibility)}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            >
              {FINE_RESPONSIBILITY.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              placeholder="Reason"
              value={respReason}
              onChange={(e) => setRespReason(e.target.value)}
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              type="button"
              disabled={busy}
              onClick={updateResponsibility}
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>
      ) : null}

      {canPayment ? (
        <section className="mt-3 space-y-2 rounded border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Update payment</p>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={payStatus}
              onChange={(e) => setPayStatus(e.target.value as FinePaymentStatus)}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            >
              {FINE_PAYMENT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Paid amount"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <input
              placeholder="Reference"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              className="rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={updatePayment}
              className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Save payment
            </button>
          </div>
        </section>
      ) : null}

      {canManage && isVehicleDefect && !fine.workOrder ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={linkWorkOrder}
            className="inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Wrench size={12} /> Create Corrective Work Order
          </button>
        </div>
      ) : null}
      {fine.workOrder ? (
        <p className="mt-3 text-right text-xs text-emerald-700">
          Linked to Work Order {fine.workOrder.workOrderNumber}
        </p>
      ) : null}
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} space-y-3 rounded-xl border border-slate-200 bg-white p-5`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
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

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-slate-800">{children}</p>
    </div>
  );
}

function FormActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return (
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
        {saving ? <Loader2 size={12} className="animate-spin" /> : null} {label}
      </button>
    </div>
  );
}
