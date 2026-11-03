"use client";

import { Suspense, useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, RefreshCw } from "lucide-react";

import { RegisterList, useRecordParam, useRegisterPage, useRegisterRecord } from "@/components/fleet/fleet-register";
import type { DataTableColumn } from "@/components/ui/data-table";
import { EntityPicker } from "@/components/ui/entity-picker";
import { ButtonSpinner, LoadingState } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { formatEnumLabel } from "@/lib/display-labels";
import { formatDate } from "@/lib/localization";
import { CLAIM_STATUS, formatCurrency, p4Post } from "@/lib/phase4-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredPermissions } from "@/lib/user-role";

interface ClaimRow {
  id: string;
  claimNumber: string;
  vehicleId: string;
  accidentId?: string | null;
  policyNumber: string;
  insurerName: string;
  status: string;
  claimAmount: number;
  approvedAmount?: number | null;
  filedAt?: string | null;
  settledAt?: string | null;
  vehicle?: { registrationNo: string; make: string; vehicleModel: string };
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  FILED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  SETTLED: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-200 text-slate-700"
};

const CLAIM_REGISTER = "/insurance-claims";

export default function InsuranceClaimsPage() {
  return (
    <Suspense fallback={<LoadingState title="Loading insurance claims" description="Fetching claims." />}>
      <InsuranceClaimsRegister />
    </Suspense>
  );
}

function InsuranceClaimsRegister() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [status, setStatus] = useState("");
  const [activeId, setActiveId] = useRecordParam();

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canManage = permissions.has("insurance_claims.manage");
  const canApprove = permissions.has("insurance_claims.approve");

  const filters = useMemo(() => ({ status }), [status]);
  const register = useRegisterPage<ClaimRow>(CLAIM_REGISTER, filters);
  const { record: active, query: activeQuery } = useRegisterRecord<ClaimRow>(CLAIM_REGISTER, activeId, register.query.data?.rows);
  const refreshing = register.query.isFetching;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["fleet-register", CLAIM_REGISTER] });

  const columns: DataTableColumn<ClaimRow>[] = [
    { id: "claim", header: "Claim", cell: (row) => <span className="font-medium text-slate-900">{row.claimNumber}</span> },
    { id: "vehicle", header: "Vehicle", cell: (row) => row.vehicle?.registrationNo ?? "—" },
    { id: "insurer", header: "Insurer", cell: (row) => row.insurerName || "—" },
    { id: "policy", header: "Policy", cell: (row) => row.policyNumber || "—", hideOnMobile: true },
    {
      id: "status",
      header: "Status",
      cell: (row) => (
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-700"}`}>
          {formatEnumLabel(row.status)}
        </span>
      )
    },
    { id: "filed", header: "Filed", cell: (row) => formatDate(row.filedAt), hideOnMobile: true },
    { id: "amount", header: "Amount", cell: (row) => formatCurrency(row.claimAmount), className: "text-right", headerClassName: "text-right" },
    { id: "approved", header: "Approved", cell: (row) => formatCurrency(row.approvedAmount), className: "text-right", headerClassName: "text-right" }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Insurance Claims</h1>
          <p className="text-sm text-slate-600">Manage vehicle insurance claims and settlements.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Claim status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-11 rounded-lg border border-slate-200 px-2 text-sm"
          >
            <option value="">All statuses</option>
            {CLAIM_STATUS.map((s) => (
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
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus aria-hidden size={14} /> New Claim
            </button>
          ) : null}
        </div>
      </header>

      {activeId && !active && activeQuery.isError ? (
        <ErrorState title="Couldn't open this claim" error={activeQuery.error} onRetry={() => void activeQuery.refetch()} />
      ) : null}

      <RegisterList
        register={register}
        columns={columns}
        getRowId={(row) => row.id}
        getRowLabel={(row) => `Open claim ${row.claimNumber}`}
        onRowClick={(row) => setActiveId(row.id)}
        ariaLabel="Insurance claims"
        emptyTitle={status ? "No claims match this status." : "No insurance claims."}
        errorTitle="Couldn't load insurance claims"
      />

      {showCreate ? (
        <CreateClaimDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            void invalidate();
          }}
        />
      ) : null}

      {active ? (
        <ClaimStatusDialog
          key={active.id}
          claim={active}
          canApprove={canApprove}
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

function CreateClaimDialog({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vehicleId: "",
    accidentId: "",
    policyNumber: "",
    insurerName: "",
    claimAmount: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.vehicleId) {
      toast.error("Choose the vehicle for this claim.");
      return;
    }
    setSaving(true);
    try {
      await p4Post("/insurance-claims", {
        vehicleId: form.vehicleId.trim(),
        accidentId: form.accidentId.trim() || undefined,
        policyNumber: form.policyNumber.trim(),
        insurerName: form.insurerName.trim(),
        claimAmount: Number(form.claimAmount),
        notes: form.notes.trim() || undefined
      });
      toast.success("Claim created");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to create claim"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Insurance Claim" onClose={onClose}>
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
          <Field label="Accident ID">
            <input
              value={form.accidentId}
              onChange={(e) => setForm({ ...form, accidentId: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Policy number *">
            <input
              required
              value={form.policyNumber}
              onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Insurer *">
            <input
              required
              value={form.insurerName}
              onChange={(e) => setForm({ ...form, insurerName: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Claim amount *">
            <input
              required
              type="number"
              value={form.claimAmount}
              onChange={(e) => setForm({ ...form, claimAmount: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <FormActions saving={saving} onClose={onClose} label="Create" />
      </form>
    </Modal>
  );
}

function ClaimStatusDialog({
  claim,
  canApprove,
  onClose,
  onSaved
}: {
  claim: ClaimRow;
  canApprove: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<string>(claim.status);
  const [approvedAmount, setApprovedAmount] = useState<string>(
    claim.approvedAmount ? String(claim.approvedAmount) : ""
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canApprove) {
      toast.error("You don't have permission to change claim status");
      return;
    }
    setSaving(true);
    try {
      await p4Post(`/insurance-claims/${claim.id}/status`, {
        status,
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        notes: notes.trim() || undefined
      });
      toast.success("Status updated");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Claim ${claim.claimNumber}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Info label="Vehicle">{claim.vehicle?.registrationNo ?? "—"}</Info>
        <Info label="Insurer">{claim.insurerName}</Info>
        <Info label="Policy">{claim.policyNumber}</Info>
        <Info label="Current status">{formatEnumLabel(claim.status)}</Info>
        <Info label="Claim amount">{formatCurrency(claim.claimAmount)}</Info>
        <Info label="Approved">{formatCurrency(claim.approvedAmount)}</Info>
        <Info label="Filed at">{formatDate(claim.filedAt)}</Info>
        <Info label="Settled at">{formatDate(claim.settledAt)}</Info>
      </div>
      {canApprove ? (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold uppercase text-slate-500">Update status</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              >
                {CLAIM_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {formatEnumLabel(s)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Approved amount">
              <input
                type="number"
                value={approvedAmount}
                onChange={(e) => setApprovedAmount(e.target.value)}
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <FormActions saving={saving} onClose={onClose} label="Update status" />
        </form>
      ) : null}
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg space-y-3 rounded-xl border border-slate-200 bg-white p-5">
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
