"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

interface LocationRow {
  id: string;
  name: string;
  area: string;
  building?: string | null;
  floor?: string | null;
  qrCode: string;
  qrCodeUrl?: string | null;
  isActive: boolean;
}

export default function CleaningLocationsPage() {
  const [rows, setRows] = useState<LocationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiClient
      .get("/cleaning/locations")
      .then((res) => setRows(res.data?.data ?? res.data ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const checklistRaw = String(fd.get("checklist") ?? "").trim();
    const checklistItems = checklistRaw
      ? checklistRaw
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({ label, required: false }))
      : undefined;

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/cleaning/locations", {
        name: String(fd.get("name") ?? ""),
        area: String(fd.get("area") ?? ""),
        building: String(fd.get("building") ?? "") || undefined,
        floor: String(fd.get("floor") ?? "") || undefined,
        shiftWindow: String(fd.get("shiftWindow") ?? "") || undefined,
        checklistItems
      });
      setOpen(false);
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "Failed to create location");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cleaning Locations</h1>
          <p className="text-sm text-slate-600">
            Manage washroom/toilet locations and their QR codes.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          {open ? "Cancel" : "+ Add location"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              name="name"
              placeholder="Location name (e.g. Block A - Ground Floor Washroom)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              name="area"
              placeholder="Area (e.g. Production)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="building"
              placeholder="Building (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="floor"
              placeholder="Floor (optional)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="shiftWindow"
              placeholder="Shift window e.g. 06:00-14:00"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
          <textarea
            name="checklist"
            placeholder={"Checklist items (one per line)\nSanitize floor\nRefill soap dispenser\nRestock toilet paper"}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            disabled={submitting}
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create location"}
          </button>
        </form>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 sm:col-span-2 lg:col-span-3">
            No locations yet.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.area}</p>
                  {r.building || r.floor ? (
                    <p className="text-xs text-slate-500">
                      {[r.building, r.floor].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                    r.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {r.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              {r.qrCodeUrl ? (
                <div className="mt-3 flex flex-col items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.qrCodeUrl}
                    alt={r.qrCode}
                    className="h-32 w-32 rounded-md border border-slate-200 bg-white"
                  />
                  <code className="text-[10px] text-slate-500">{r.qrCode}</code>
                </div>
              ) : (
                <code className="mt-3 block text-xs text-slate-500">{r.qrCode}</code>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
