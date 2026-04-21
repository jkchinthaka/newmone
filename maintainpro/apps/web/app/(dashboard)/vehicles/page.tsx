"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, RefreshCw, Trash2, Wrench, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type VehicleType = "CAR" | "MOTORCYCLE" | "TRUCK" | "VAN" | "BUS" | "HEAVY_EQUIPMENT" | "OTHER";
type FuelType = "PETROL" | "DIESEL" | "ELECTRIC" | "HYBRID" | "CNG" | "LPG";
type VehicleStatus = "AVAILABLE" | "IN_USE" | "UNDER_MAINTENANCE" | "OUT_OF_SERVICE" | "DISPOSED";

interface Vehicle {
  id: string;
  registrationNo: string;
  make: string;
  vehicleModel: string;
  year: number;
  type: VehicleType;
  fuelType: FuelType;
  status: VehicleStatus;
  currentMileage: number | string;
  color?: string | null;
  nextServiceDate?: string | null;
  nextServiceMileage?: number | null;
}

interface MaintenanceLog {
  id: string;
  description: string;
  performedBy: string;
  performedAt: string;
  cost?: number | string | null;
  notes?: string | null;
  vehicleId?: string | null;
}

const VEHICLE_TYPES: VehicleType[] = ["CAR", "MOTORCYCLE", "TRUCK", "VAN", "BUS", "HEAVY_EQUIPMENT", "OTHER"];
const FUEL_TYPES: FuelType[] = ["PETROL", "DIESEL", "ELECTRIC", "HYBRID", "CNG", "LPG"];
const STATUSES: VehicleStatus[] = ["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "OUT_OF_SERVICE", "DISPOSED"];

const STATUS_STYLES: Record<VehicleStatus, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700",
  IN_USE: "bg-sky-100 text-sky-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700",
  OUT_OF_SERVICE: "bg-rose-100 text-rose-700",
  DISPOSED: "bg-slate-200 text-slate-600"
};

export default function VehiclesPage() {
  const [rows, setRows] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [maintenanceFor, setMaintenanceFor] = useState<Vehicle | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/vehicles");
      const list: Vehicle[] = res.data?.data ?? res.data ?? [];
      setRows(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load vehicles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(v: Vehicle) {
    if (!confirm(`Delete vehicle ${v.registrationNo}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/vehicles/${v.id}`);
      load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Vehicles</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
          >
            <Plus size={14} /> Register Vehicle
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {loading ? (
        <div className="card flex items-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading vehicles…
        </div>
      ) : rows.length === 0 ? (
        <div className="card py-8 text-center text-sm text-slate-500">
          No vehicles yet. Click <span className="font-medium">Register Vehicle</span> to add one.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((v) => (
            <article key={v.id} className="card flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{v.registrationNo}</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {v.make} {v.vehicleModel}
                  </h3>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v.status]}`}>
                  {v.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-slate-600">
                {v.year} • {v.type} • {v.fuelType}
              </p>
              <p className="text-sm text-slate-600">
                Mileage: {Number(v.currentMileage).toLocaleString()} km
              </p>
              {v.nextServiceDate && (
                <p className="text-xs text-slate-500">
                  Next service: {new Date(v.nextServiceDate).toLocaleDateString()}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setMaintenanceFor(v)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                >
                  <Wrench size={12} /> Maintenance
                </button>
                <button
                  onClick={() => setEditing(v)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100"
                >
                  <Pencil size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(v)}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateVehicleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {editing && (
        <EditVehicleModal
          vehicle={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      {maintenanceFor && (
        <MaintenanceModal
          vehicle={maintenanceFor}
          onClose={() => setMaintenanceFor(null)}
          onChanged={() => load()}
        />
      )}
    </div>
  );
}

// ---------------- Create modal ----------------

function CreateVehicleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    registrationNo: "",
    make: "",
    vehicleModel: "",
    year: new Date().getFullYear(),
    type: "CAR" as VehicleType,
    fuelType: "PETROL" as FuelType,
    currentMileage: 0
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.registrationNo.trim() || !form.make.trim() || !form.vehicleModel.trim()) {
      setErr("Registration, make and model are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post("/vehicles", {
        registrationNo: form.registrationNo.trim(),
        make: form.make.trim(),
        vehicleModel: form.vehicleModel.trim(),
        year: Number(form.year),
        type: form.type,
        fuelType: form.fuelType,
        currentMileage: Number(form.currentMileage) || 0
      });
      onCreated();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to create vehicle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Register Vehicle" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Registration No *">
            <input required value={form.registrationNo} onChange={(e) => setForm({ ...form, registrationNo: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Year *">
            <input type="number" required value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Make *">
            <input required value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Model *">
            <input required value={form.vehicleModel} onChange={(e) => setForm({ ...form, vehicleModel: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VehicleType })} className={inputCls}>
              {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Fuel">
            <select value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value as FuelType })} className={inputCls}>
              {FUEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Current Mileage (km)" className="col-span-2">
            <input type="number" min={0} value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
        {err && <ErrBanner msg={err} />}
        <FormActions busy={busy} onClose={onClose} submitLabel="Create" />
      </form>
    </ModalShell>
  );
}

// ---------------- Edit modal ----------------

function EditVehicleModal({ vehicle, onClose, onSaved }: { vehicle: Vehicle; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    status: vehicle.status,
    currentMileage: Number(vehicle.currentMileage),
    color: vehicle.color ?? "",
    nextServiceDate: vehicle.nextServiceDate ? vehicle.nextServiceDate.slice(0, 10) : "",
    nextServiceMileage: vehicle.nextServiceMileage ?? 0
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await apiClient.patch(`/vehicles/${vehicle.id}`, {
        status: form.status,
        currentMileage: Number(form.currentMileage),
        color: form.color || undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        nextServiceMileage: form.nextServiceMileage ? Number(form.nextServiceMileage) : undefined
      });
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to update vehicle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={`Edit ${vehicle.registrationNo}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })} className={inputCls}>
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Current Mileage (km)">
            <input type="number" min={Number(vehicle.currentMileage)} value={form.currentMileage} onChange={(e) => setForm({ ...form, currentMileage: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Color">
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Next Service Date">
            <input type="date" value={form.nextServiceDate} onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Next Service Mileage" className="col-span-2">
            <input type="number" min={0} value={form.nextServiceMileage} onChange={(e) => setForm({ ...form, nextServiceMileage: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Note: mileage must not be lower than the current value ({Number(vehicle.currentMileage).toLocaleString()} km).
        </p>
        {err && <ErrBanner msg={err} />}
        <FormActions busy={busy} onClose={onClose} submitLabel="Save changes" />
      </form>
    </ModalShell>
  );
}

// ---------------- Maintenance drawer ----------------

function MaintenanceModal({
  vehicle,
  onClose,
  onChanged
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<VehicleStatus>(vehicle.status);
  const [form, setForm] = useState({
    description: "",
    performedBy: "",
    performedAt: new Date().toISOString().slice(0, 10),
    cost: 0,
    notes: ""
  });

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await apiClient.get("/maintenance/logs");
      const all: MaintenanceLog[] = res.data?.data ?? res.data ?? [];
      setLogs(all.filter((l) => l.vehicleId === vehicle.id));
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id]);

  async function setVehicleStatus(next: VehicleStatus) {
    setBusy(true);
    setErr(null);
    try {
      await apiClient.patch(`/vehicles/${vehicle.id}`, { status: next });
      setStatus(next);
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function addLog(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim() || !form.performedBy.trim()) {
      setErr("Description and performed-by are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post("/maintenance/logs", {
        vehicleId: vehicle.id,
        description: form.description.trim(),
        performedBy: form.performedBy.trim(),
        performedAt: new Date(form.performedAt).toISOString(),
        cost: Number(form.cost) || 0,
        notes: form.notes.trim() || undefined
      });
      // Marking maintenance done implies the vehicle returns to AVAILABLE.
      if (status === "UNDER_MAINTENANCE") {
        await apiClient.patch(`/vehicles/${vehicle.id}`, { status: "AVAILABLE" });
        setStatus("AVAILABLE");
      }
      setForm({ description: "", performedBy: "", performedAt: new Date().toISOString().slice(0, 10), cost: 0, notes: "" });
      await loadLogs();
      onChanged();
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? "Failed to record maintenance");
    } finally {
      setBusy(false);
    }
  }

  const totalSpent = useMemo(
    () => logs.reduce((sum, l) => sum + Number(l.cost ?? 0), 0),
    [logs]
  );

  return (
    <ModalShell title={`Maintenance — ${vehicle.registrationNo}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <div className="text-sm">
            Current status:{" "}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
              {status.replace("_", " ")}
            </span>
          </div>
          <div className="flex gap-2">
            {status !== "UNDER_MAINTENANCE" && (
              <button
                disabled={busy}
                onClick={() => setVehicleStatus("UNDER_MAINTENANCE")}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Send to maintenance
              </button>
            )}
            {status === "UNDER_MAINTENANCE" && (
              <button
                disabled={busy}
                onClick={() => setVehicleStatus("AVAILABLE")}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Mark complete (Available)
              </button>
            )}
          </div>
        </div>

        <form onSubmit={addLog} className="space-y-3 rounded-lg border border-slate-200 p-3">
          <h4 className="text-sm font-semibold text-slate-800">Add maintenance record</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Description *" className="col-span-2">
              <input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} placeholder="Oil change, brake pad replacement…" />
            </Field>
            <Field label="Performed by *">
              <input required value={form.performedBy} onChange={(e) => setForm({ ...form, performedBy: e.target.value })} className={inputCls} placeholder="Mechanic name" />
            </Field>
            <Field label="Performed at *">
              <input type="date" required value={form.performedAt} onChange={(e) => setForm({ ...form, performedAt: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Cost">
              <input type="number" min={0} step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputCls} />
            </Field>
          </div>
          <p className="text-xs text-slate-500">
            Saving will also mark the vehicle <span className="font-medium">Available</span> if it is currently under maintenance.
          </p>
          {err && <ErrBanner msg={err} />}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Save record
            </button>
          </div>
        </form>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">History ({logs.length})</h4>
            <span className="text-xs text-slate-500">Total spent: ₹{totalSpent.toLocaleString()}</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500">No maintenance records yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {logs.map((l) => (
                <li key={l.id} className="px-3 py-2 text-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{l.description}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(l.performedAt).toLocaleDateString()} • {l.performedBy}
                      </p>
                      {l.notes && <p className="mt-1 text-xs text-slate-600">{l.notes}</p>}
                    </div>
                    <span className="text-xs font-medium text-slate-700">
                      ₹{Number(l.cost ?? 0).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------- shared bits ----------------

const inputCls = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm";

function ModalShell({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-xl ${wide ? "max-w-2xl" : "max-w-lg"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>
  );
}

function FormActions({ busy, onClose, submitLabel }: { busy: boolean; onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
        Cancel
      </button>
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50">
        {busy && <Loader2 size={14} className="animate-spin" />} {submitLabel}
      </button>
    </div>
  );
}
