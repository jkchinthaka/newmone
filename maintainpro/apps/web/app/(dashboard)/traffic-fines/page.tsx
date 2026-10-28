"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { DateField } from "@/components/forms/date-fields";
import { toast } from "sonner";
import { Plus, RefreshCw, Wrench } from "lucide-react";

import { RegisterList, useRecordParam, useRegisterPage, useRegisterRecord } from "@/components/fleet/fleet-register";
import type { DataTableColumn } from "@/components/ui/data-table";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ButtonSpinner, LoadingState } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { formatEnumLabel } from "@/lib/display-labels";
import { formatDate } from "@/lib/localization";
import {
  FINE_PAYMENT_STATUS,
  FINE_RESPONSIBILITY,
  formatCurrency,
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

const FINE_REGISTER = "/traffic-fines";

export default function TrafficFinesPage() {
  return (
    <Suspense fallback={<LoadingState title="Loading traffic fines" description="Fetching fines." />}>
      <TrafficFinesRegister />
    </Suspense>
  );
}

function TrafficFinesRegister() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useRecordParam();
  const [paymentStatus, setPaymentStatus] = useState("");
  const [responsibility, setResponsibility] = useState("");

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canReport = permissions.has("traffic_fines.report");
  const canManage = permissions.has("traffic_fines.manage");
  const canPayment = permissions.has("traffic_fines.payment");

  const filters = useMemo(() => ({ paymentStatus, responsibility }), [paymentStatus, responsibility]);
  const register = useRegisterPage<FineRow>(FINE_REGISTER, filters);
  const { record: active, query: activeQuery } = useRegisterRecord<FineRow>(FINE_REGISTER, activeId, register.query.data?.rows);
  const refreshing = register.query.isFetching;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fleet-register", FINE_REGISTER] });

  const columns: DataTableColumn<FineRow>[] = [
    { id: "fine", header: "Fine", cell: (row) => <span className="font-medium text-slate-900">{row.fineNumber}</span> },
    { id: "vehicle", header: "Vehicle", cell: (row) => row.vehicle?.registrationNo ?? "—" },
    { id: "date", header: "Date", cell: (row) => formatDate(row.fineDate) },
    { id: "offense", header: "Offense", cell: (row) => row.description || "—", hideOnMobile: true },
    {
      id: "responsibility",
      header: "Responsibility",
      cell: (row) =>
        row.responsibility ? (
          <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${RESPONSIBILITY_BADGE[row.responsibility] ?? "bg-slate-100 text-slate-700"}`}>
            {formatEnumLabel(row.responsibility)}
          </span>
        ) : (
          "—"
        )
    },
    {
      id: "payment",
      header: "Payment",
      cell: (row) => (
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.paymentStatus] ?? "bg-slate-100 text-slate-700"}`}>
          {formatEnumLabel(row.paymentStatus)}
        </span>
      )
    },
    { id: "wo", header: "Job", cell: (row) => row.workOrder?.workOrderNumber ?? "—", hideOnMobile: true },
    { id: "amount", header: "Amount", cell: (row) => formatCurrency(row.fineAmount), className: "text-right", headerClassName: "text-right" }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Traffic Fines</h1>
          <p className="text-sm text-slate-600">
            Record traffic violations and classify responsibility based on vehicle document validity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Payment status"
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">All payment statuses</option>
            {FINE_PAYMENT_STATUS.map((s) => (
              <option key={s} value={s}>
                {formatEnumLabel(s)}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsibility"
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
            className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">All responsibility</option>
            {FINE_RESPONSIBILITY.map((s) => (
              <option key={s} value={s}>
                {formatEnumLabel(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void register.query.refetch()}
            disabled={refreshing}
            aria-busy={refreshing}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {refreshing ? <ButtonSpinner /> : <RefreshCw aria-hidden size={14} />} Refresh
          </button>
          {canReport ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus aria-hidden size={14} /> Report Fine
            </button>
          ) : null}
        </div>
      </header>

      {activeId && !active && activeQuery.isError ? (
        <ErrorState title="Couldn't open this fine" error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
      ) : null}

      <RegisterList
        register={register}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `Open fine ${row.fineNumber}`}
        onRowClick={(row) => setActiveId(row.id)}
        ariaLabel="Traffic fines"
        emptyTitle={paymentStatus || responsibility ? "No fines match these filters." : "No fines recorded."}
        errorTitle="Couldn't load traffic fines"
      />

      {showCreate ? (
        <CreateFineDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void invalidate();
          }}
        />
      ) : null}

      {active ? (
        <FineDetailDialog
          key={active.id}
          fine={active}
          canManage={canManage}
          canPayment={canPayment}
          onClose={() => setActiveId(null)}
          onSaved={() => {
            setActiveId(null);
            void invalidate();
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
    if (!form.vehicleId) {
      toast.error("Choose the vehicle that was fined.");
      return;
    }
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
          <Field label="Vehicle *">
            <EntityPicker<{ id: string; registrationNo: string; vehicleModel?: string }>
              endpoint="/vehicles"
              value={form.vehicleId || null}
              displayField="registrationNo"
              secondaryField="vehicleModel"
              placeholder="Search registration..."
              required
              onChange={(id) => setForm((current) => ({ ...current, vehicleId: id ?? "" }))}
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
            <DateField bare label="Fine date" value={form.fineDate} onChange={(fineDate) => setForm({ ...form, fineDate })} />
            <input required value={form.fineDate} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
          </Field>
          <Field label="Due date">
            <DateField bare label="Due date" value={form.dueDate} onChange={(dueDate) => setForm({ ...form, dueDate })} />
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
                  {formatEnumLabel(r)}
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
        <Field label="Photos URLs (one per line)">
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
      toast.success("Job linked");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to link job"));
    } finally {
      setBusy(false);
    }
  };

  const isVehicleDefect = (fine.responsibility ?? resp) === "VEHICLE_DEFECT";

  return (
    <Modal title={`Fine ${fine.fineNumber}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Vehicle">{fine.vehicle?.registrationNo ?? "—"}</Info>
        <Info label="Fine date">{formatDate(fine.fineDate)}</Info>
        <Info label="Due date">{formatDate(fine.dueDate)}</Info>
        <Info label="Amount">{formatCurrency(fine.fineAmount)}</Info>
        <Info label="Offense">{fine.description}</Info>
        <Info label="Violation code">{fine.violationCode ?? "—"}</Info>
        <Info label="Responsibility">{formatEnumLabel(fine.responsibility)}</Info>
        <Info label="Payment status">{formatEnumLabel(fine.paymentStatus)}</Info>
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
                  {formatEnumLabel(r)}
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
                  {formatEnumLabel(s)}
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
            <Wrench size={12} /> Create repair job
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
        {saving ? <ButtonSpinner className="h-3 w-3" /> : null} {label}
      </button>
    </div>
  );
}
