"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw } from "lucide-react";

import {
  CLAIM_STATUS,
  formatCurrency,
  formatDate,
  p4Get,
  p4Post
} from "@/lib/phase4-api";
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

export default function InsuranceClaimsPage() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [active, setActive] = useState<ClaimRow | null>(null);

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canManage = permissions.has("insurance_claims.manage");
  const canApprove = permissions.has("insurance_claims.approve");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await p4Get<ClaimRow[]>("/insurance-claims");
      setRows(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load insurance claims"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Insurance Claims</h1>
          <p className="text-sm text-slate-600">Manage vehicle insurance claims and settlements.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {canManage ? (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus size={14} /> New Claim
            </button>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Claim</th>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Insurer</th>
                <th className="px-4 py-2 text-left">Policy</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Filed</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-right">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading..." : "No insurance claims."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setActive(row)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{row.claimNumber}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.vehicle?.registrationNo ?? row.vehicleId}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{row.insurerName}</td>
                    <td className="px-4 py-2 text-slate-700">{row.policyNumber}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[row.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{formatDate(row.filedAt)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(row.claimAmount)}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(row.approvedAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <CreateClaimDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      ) : null}

      {active ? (
        <ClaimStatusDialog
          claim={active}
          canApprove={canApprove}
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
          <Field label="Vehicle ID *">
            <input
              required
              value={form.vehicleId}
              onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
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
        <Info label="Vehicle">{claim.vehicle?.registrationNo ?? claim.vehicleId}</Info>
        <Info label="Insurer">{claim.insurerName}</Info>
        <Info label="Policy">{claim.policyNumber}</Info>
        <Info label="Current status">{claim.status}</Info>
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
                    {s}
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
        {saving ? <Loader2 size={12} className="animate-spin" /> : null} {label}
      </button>
    </div>
  );
}
