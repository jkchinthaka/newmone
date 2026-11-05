"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type Plan = { id: string; name: string; pinCount: number };

export default function FloorPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ data: Plan[] }>("/floor-plans", { params: q ? { q } : {} });
      setPlans(res.data.data ?? []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load floor plans."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(search), 250);
    return () => clearTimeout(timer);
  }, [load, search]);

  async function create() {
    if (!name.trim() || !file) {
      toast.error("Enter a name and choose an image.");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set("name", name.trim());
      body.set("file", file);
      await apiClient.post("/floor-plans", body);
      toast.success("Floor plan created");
      setCreating(false);
      setName("");
      setFile(null);
      await load(search);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create the floor plan."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Floor Plans</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search floor plans"
            aria-label="Search floor plans"
            className="min-h-11 w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm"
          />
          <button type="button" onClick={() => setCreating(true)} className="min-h-11 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
            + Floor Plan
          </button>
        </div>
      </header>

      {creating ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="New floor plan">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3" placeholder="e.g. Packing hall, ground floor" />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Image (PNG, JPG or WEBP, up to 3 MB)</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void create()} className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {!loading && plans.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-semibold text-slate-800">No Floor Plans Created Yet</p>
          <p className="mt-1 text-sm text-slate-500">Use the + Floor Plan button on the top to create one.</p>
        </div>
      ) : null}
      {plans.length > 0 ? (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link href={`/floor-plans/${plan.id}` as Route} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                <span className="font-medium text-slate-900">{plan.name}</span>
                <span className="text-slate-500">{plan.pinCount} asset{plan.pinCount === 1 ? "" : "s"} pinned</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
