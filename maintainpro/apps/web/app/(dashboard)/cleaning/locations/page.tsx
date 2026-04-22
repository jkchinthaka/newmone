"use client";

import QRCode from "react-qr-code";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";

import { apiClient } from "@/lib/api-client";

type RoleName = "SUPER_ADMIN" | "ADMIN" | "SUPERVISOR" | "CLEANER" | "VIEWER" | string;

interface AuthUser {
  id: string;
  role?: {
    name?: RoleName;
  } | null;
}

interface LocationRow {
  id: string;
  name: string;
  area: string;
  building?: string | null;
  floor?: string | null;
  qrCode: string;
  scanUrl: string;
  isActive: boolean;
  todayVisitCount: number;
}

export default function CleaningLocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  const isAdmin = useMemo(() => {
    const role = user?.role?.name;
    return role === "ADMIN" || role === "SUPER_ADMIN";
  }, [user]);

  const load = useCallback(() => {
    setLoading(true);

    Promise.all([apiClient.get("/cleaning/locations"), apiClient.get("/auth/me")])
      .then(([locationsRes, meRes]) => {
        setRows(locationsRes.data?.data ?? []);
        setUser(meRes.data?.data ?? null);
        setError(null);
      })
      .catch((err: { response?: { data?: { message?: string } } }) => {
        setError(err?.response?.data?.message ?? "Failed to load cleaning locations");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const checklistRaw = String(formData.get("checklist") ?? "").trim();
    const checklistItems = checklistRaw
      ? checklistRaw
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean)
          .map((label) => ({ label, required: false }))
      : undefined;

    setSubmitting(true);
    setError(null);

    try {
      await apiClient.post("/cleaning/locations", {
        name: String(formData.get("name") ?? ""),
        area: String(formData.get("area") ?? ""),
        building: String(formData.get("building") ?? "") || undefined,
        floor: String(formData.get("floor") ?? "") || undefined,
        description: String(formData.get("description") ?? "") || undefined,
        shiftWindow: String(formData.get("shiftWindow") ?? "") || undefined,
        checklistItems
      });

      setShowForm(false);
      event.currentTarget.reset();
      load();
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadQr = async (row: LocationRow) => {
    setDownloadId(row.id);
    setError(null);

    try {
      const response = await apiClient.get(`/cleaning/locations/${row.id}/qr`, {
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const typedError = err as { response?: { data?: { message?: string } } };
      setError(typedError?.response?.data?.message ?? "Failed to download QR code");
    } finally {
      setDownloadId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cleaning Locations</h1>
          <p className="text-sm text-slate-600">
            View washroom QR codes, today&apos;s cleaning counts, and print signage-ready QR labels.
          </p>
        </div>

        {isAdmin ? (
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            {showForm ? "Cancel" : "Add New Location"}
          </button>
        ) : null}
      </div>

      {showForm ? (
        <form onSubmit={submit} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              required
              name="name"
              placeholder="Ground Floor - Male Toilet"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              name="area"
              placeholder="Area / Wing"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="building"
              placeholder="Building"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="floor"
              placeholder="Floor"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="shiftWindow"
              placeholder="Shift window (e.g. 06:00-14:00)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <textarea
              name="description"
              placeholder="Optional description"
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
            <textarea
              name="checklist"
              rows={4}
              placeholder={"Checklist items, one per line\nSanitize floor\nRestock tissue\nRefill soap"}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Location"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3">QR</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading locations...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No cleaning locations found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{row.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.qrCode}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      <div>{row.area}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[row.building, row.floor].filter(Boolean).join(" · ") || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {row.todayVisitCount} visits
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-3">
                        <QRCode value={row.scanUrl} size={76} />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <a
                          href={row.scanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-xs font-medium text-sky-700 hover:text-sky-800"
                        >
                          Open scan URL
                        </a>
                        {isAdmin ? (
                          <button
                            type="button"
                            onClick={() => downloadQr(row)}
                            disabled={downloadId === row.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <Download size={14} />
                            {downloadId === row.id ? "Preparing..." : "Download QR"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Admin download only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}