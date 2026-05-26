"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CarFront, Loader2, Plus, RefreshCw, Wrench } from "lucide-react";

import {
  ACCIDENT_EVIDENCE_TYPES,
  ACCIDENT_SEVERITY,
  ACCIDENT_STATUS,
  formatCurrency,
  formatDateTime,
  p4Get,
  p4Patch,
  p4Post
} from "@/lib/phase4-api";
import { getApiErrorMessage } from "@/lib/api-client";
import { getStoredPermissions } from "@/lib/user-role";

interface AccidentRow {
  id: string;
  reportNumber: string;
  vehicleId: string;
  driverId?: string | null;
  occurredAt: string;
  location: string;
  severity: string;
  status: string;
  estimatedDamageCost?: number | null;
  actualDamageCost?: number | null;
  vehicle?: { registrationNo: string; make: string; vehicleModel: string };
  workOrder?: { id: string; workOrderNumber: string } | null;
}

interface AccidentDetail extends AccidentRow {
  description: string;
  thirdPartyInvolved?: boolean;
  thirdPartyDetails?: string | null;
  policeReportNo?: string | null;
  notes?: string | null;
  evidence?: Array<{ id: string; evidenceType: string; fileUrl: string; description?: string | null }>;
}

export default function AccidentsPage() {
  const [rows, setRows] = useState<AccidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ vehicleId?: string; status?: string }>({});

  const permissions = useMemo(() => new Set(getStoredPermissions()), []);
  const canReport = permissions.has("accidents.report");
  const canManage = permissions.has("accidents.manage");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await p4Get<AccidentRow[]>("/accidents", filter);
      setRows(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load accidents"));
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
          <h1 className="text-2xl font-semibold text-slate-900">Accident Reports</h1>
          <p className="text-sm text-slate-600">Track and manage vehicle accident incidents.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Filter by vehicle ID"
            className="rounded border border-slate-200 px-2 py-1 text-sm"
            onBlur={(e) => setFilter((prev) => ({ ...prev, vehicleId: e.target.value || undefined }))}
          />
          <select
            value={filter.status ?? ""}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value || undefined }))}
            className="rounded border border-slate-200 px-2 py-1 text-sm"
          >
            <option value="">All statuses</option>
            {ACCIDENT_STATUS.map((s) => (
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
              <Plus size={14} /> Report Accident
            </button>
          ) : null}
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Report</th>
                <th className="px-4 py-2 text-left">Vehicle</th>
                <th className="px-4 py-2 text-left">Occurred</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">WO</th>
                <th className="px-4 py-2 text-right">Damage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                    {loading ? "Loading..." : "No accidents reported."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => setActiveId(row.id)}
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">{row.reportNumber}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.vehicle?.registrationNo ?? row.vehicleId}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{formatDateTime(row.occurredAt)}</td>
                    <td className="px-4 py-2 text-slate-700">{row.location}</td>
                    <td className="px-4 py-2 text-slate-700">{row.severity}</td>
                    <td className="px-4 py-2 text-slate-700">{row.status}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {row.workOrder ? row.workOrder.workOrderNumber : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {formatCurrency(row.actualDamageCost ?? row.estimatedDamageCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showCreate ? (
        <CreateAccidentDialog
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            refresh();
          }}
        />
      ) : null}

      {activeId ? (
        <AccidentDetailDialog
          id={activeId}
          onClose={() => setActiveId(null)}
          onChanged={() => {
            refresh();
          }}
          canManage={canManage}
          canReport={canReport}
        />
      ) : null}
    </div>
  );
}

function CreateAccidentDialog({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    vehicleId: "",
    driverId: "",
    occurredAt: "",
    location: "",
    description: "",
    severity: "MINOR",
    thirdPartyInvolved: false,
    thirdPartyDetails: "",
    policeReportNo: "",
    estimatedDamageCost: ""
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await p4Post("/accidents", {
        vehicleId: form.vehicleId.trim(),
        driverId: form.driverId.trim() || undefined,
        occurredAt: form.occurredAt,
        location: form.location.trim(),
        description: form.description.trim(),
        severity: form.severity,
        thirdPartyInvolved: form.thirdPartyInvolved,
        thirdPartyDetails: form.thirdPartyDetails.trim() || undefined,
        policeReportNo: form.policeReportNo.trim() || undefined,
        estimatedDamageCost: form.estimatedDamageCost ? Number(form.estimatedDamageCost) : undefined
      });
      toast.success("Accident reported");
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to report accident"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Report Accident" onClose={onClose}>
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
          <Field label="Occurred at *">
            <input
              required
              type="datetime-local"
              value={form.occurredAt}
              onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Severity">
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            >
              {ACCIDENT_SEVERITY.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Location *">
          <input
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <Field label="Description *">
          <textarea
            required
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Police report no">
            <input
              value={form.policeReportNo}
              onChange={(e) => setForm({ ...form, policeReportNo: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
          <Field label="Estimated damage">
            <input
              type="number"
              value={form.estimatedDamageCost}
              onChange={(e) => setForm({ ...form, estimatedDamageCost: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.thirdPartyInvolved}
            onChange={(e) => setForm({ ...form, thirdPartyInvolved: e.target.checked })}
          />
          Third party involved
        </label>
        {form.thirdPartyInvolved ? (
          <Field label="Third party details">
            <textarea
              rows={2}
              value={form.thirdPartyDetails}
              onChange={(e) => setForm({ ...form, thirdPartyDetails: e.target.value })}
              className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
            />
          </Field>
        ) : null}
        <FormActions saving={saving} onClose={onClose} label="Report" />
      </form>
    </Modal>
  );
}

function AccidentDetailDialog({
  id,
  onClose,
  onChanged,
  canManage,
  canReport
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
  canManage: boolean;
  canReport: boolean;
}) {
  const [detail, setDetail] = useState<AccidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceType, setEvidenceType] = useState<string>(ACCIDENT_EVIDENCE_TYPES[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await p4Get<AccidentDetail>(`/accidents/${id}`);
      setDetail(data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to load accident"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (status: string) => {
    setBusy(true);
    try {
      await p4Patch(`/accidents/${id}`, { status });
      toast.success("Status updated");
      await load();
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to update status"));
    } finally {
      setBusy(false);
    }
  };

  const addEvidence = async () => {
    if (!evidenceUrl.trim()) return;
    setBusy(true);
    try {
      await p4Post(`/accidents/${id}/evidence`, {
        evidenceType,
        fileUrl: evidenceUrl.trim()
      });
      setEvidenceUrl("");
      toast.success("Evidence added");
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to add evidence"));
    } finally {
      setBusy(false);
    }
  };

  const linkWorkOrder = async () => {
    setBusy(true);
    try {
      await p4Post(`/accidents/${id}/work-order`, { priority: "HIGH" });
      toast.success("Work order linked");
      await load();
      onChanged();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to link work order"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={detail?.reportNumber ?? "Accident"} onClose={onClose} wide>
      {loading || !detail ? (
        <div className="grid place-items-center py-10 text-sm text-slate-500">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Vehicle">
              {detail.vehicle?.registrationNo ?? detail.vehicleId}
            </Info>
            <Info label="Occurred">{formatDateTime(detail.occurredAt)}</Info>
            <Info label="Severity">{detail.severity}</Info>
            <Info label="Status">{detail.status}</Info>
            <Info label="Location">{detail.location}</Info>
            <Info label="Police report">{detail.policeReportNo ?? "—"}</Info>
            <Info label="Est. damage">{formatCurrency(detail.estimatedDamageCost)}</Info>
            <Info label="Actual damage">{formatCurrency(detail.actualDamageCost)}</Info>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {detail.description}
          </div>
          {detail.thirdPartyDetails ? (
            <Info label="Third party details">{detail.thirdPartyDetails}</Info>
          ) : null}

          <section className="rounded border border-slate-200 bg-white">
            <header className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              Evidence ({detail.evidence?.length ?? 0})
            </header>
            <ul className="divide-y divide-slate-100">
              {(detail.evidence ?? []).map((ev) => (
                <li key={ev.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{ev.evidenceType}</span>
                    {ev.description ? <span className="ml-2 text-slate-500">{ev.description}</span> : null}
                  </span>
                  <a
                    href={ev.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-600 hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
              {(!detail.evidence || detail.evidence.length === 0) && (
                <li className="px-3 py-3 text-center text-sm text-slate-500">No evidence added.</li>
              )}
            </ul>
            {canReport ? (
              <div className="flex items-center gap-2 border-t border-slate-200 p-3">
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value)}
                  className="rounded border border-slate-200 px-2 py-1 text-sm"
                >
                  {ACCIDENT_EVIDENCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="File URL"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={addEvidence}
                  disabled={busy || !evidenceUrl.trim()}
                  className="rounded bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                {ACCIDENT_STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy || detail.status === s}
                    onClick={() => updateStatus(s)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
                {!detail.workOrder ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={linkWorkOrder}
                    className="ml-auto inline-flex items-center gap-1 rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Wrench size={12} /> Create Work Order
                  </button>
                ) : (
                  <span className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                    <CarFront size={12} /> WO {detail.workOrder.workOrderNumber}
                  </span>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
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

function FormActions({
  saving,
  onClose,
  label
}: {
  saving: boolean;
  onClose: () => void;
  label: string;
}) {
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
