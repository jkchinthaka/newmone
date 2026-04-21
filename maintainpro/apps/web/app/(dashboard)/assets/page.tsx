"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";

type AssetCategory =
  | "MACHINE"
  | "TOOL"
  | "INFRASTRUCTURE"
  | "EQUIPMENT"
  | "VEHICLE"
  | "OTHER";

type AssetStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "UNDER_MAINTENANCE"
  | "DISPOSED"
  | "RETIRED";

interface Asset {
  id: string;
  assetTag: string;
  name: string;
  category: AssetCategory;
  status: AssetStatus;
  location?: string | null;
  description?: string | null;
  qrCodeUrl?: string | null;
  createdAt: string;
}

const CATEGORIES: AssetCategory[] = [
  "MACHINE",
  "TOOL",
  "INFRASTRUCTURE",
  "EQUIPMENT",
  "VEHICLE",
  "OTHER"
];

const STATUSES: AssetStatus[] = [
  "ACTIVE",
  "INACTIVE",
  "UNDER_MAINTENANCE",
  "DISPOSED",
  "RETIRED"
];

const STATUS_STYLES: Record<AssetStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-100 text-slate-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-700",
  DISPOSED: "bg-rose-100 text-rose-700",
  RETIRED: "bg-slate-200 text-slate-600"
};

function suggestTag() {
  return `AST-${Date.now().toString().slice(-6)}`;
}

export default function AssetsPage() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get("/assets", {
        params: { limit: 100, status: statusFilter || undefined }
      });
      const list: Asset[] = res.data?.data ?? res.data ?? [];
      setRows(list);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to load assets"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.assetTag, r.name, r.category, r.location ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-900">Assets</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
          >
            <Plus size={14} /> Create Asset
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2">
          <Search size={16} className="text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search by tag, name, category, location"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AssetStatus | "")}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading assets…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No assets yet. Click <span className="font-medium">Create Asset</span> to add one.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2">Asset Tag</th>
                <th className="py-2">Name</th>
                <th className="py-2">Category</th>
                <th className="py-2">Status</th>
                <th className="py-2">Location</th>
                <th className="py-2 text-right">QR</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium text-slate-800">{row.assetTag}</td>
                  <td className="py-3">{row.name}</td>
                  <td className="py-3">{row.category}</td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                    >
                      {row.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3">{row.location ?? "—"}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => setQrAsset(row)}
                      disabled={!row.qrCodeUrl}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                    >
                      <Download size={12} /> QR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateAssetModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {qrAsset && <QrModal asset={qrAsset} onClose={() => setQrAsset(null)} />}
    </div>
  );
}

function CreateAssetModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    assetTag: suggestTag(),
    name: "",
    category: "MACHINE" as AssetCategory,
    status: "ACTIVE" as AssetStatus,
    location: "",
    description: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.assetTag.trim() || !form.name.trim()) {
      setErr("Asset tag and name are required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await apiClient.post("/assets", {
        assetTag: form.assetTag.trim(),
        name: form.name.trim(),
        category: form.category,
        status: form.status,
        location: form.location.trim() || undefined,
        description: form.description.trim() || undefined
      });
      onCreated();
    } catch (e: any) {
      setErr(
        e?.response?.data?.message ?? e?.message ?? "Failed to create asset"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">New Asset</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Asset Tag *">
            <input
              required
              value={form.assetTag}
              onChange={(e) => setForm({ ...form, assetTag: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Name *">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) =>
                setForm({ ...form, category: e.target.value as AssetCategory })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as AssetStatus })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Location" className="col-span-2">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              placeholder="Plant A / Building 2 / Floor 3"
            />
          </Field>
          <Field label="Description" className="col-span-2">
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={3}
              className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </Field>
        </div>

        {err && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

function QrModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 text-center shadow-xl"
      >
        <h3 className="text-lg font-semibold text-slate-900">{asset.assetTag}</h3>
        <p className="text-sm text-slate-500">{asset.name}</p>
        {asset.qrCodeUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.qrCodeUrl}
            alt={`QR ${asset.assetTag}`}
            className="mx-auto h-48 w-48"
          />
        ) : (
          <p className="text-sm text-slate-500">No QR available.</p>
        )}
        <div className="flex justify-center gap-2">
          {asset.qrCodeUrl && (
            <a
              href={asset.qrCodeUrl}
              download={`${asset.assetTag}.png`}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-100"
            >
              <Download size={12} /> Download
            </a>
          )}
          <button
            onClick={onClose}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
