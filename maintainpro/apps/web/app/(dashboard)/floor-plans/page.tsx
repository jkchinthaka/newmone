"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { PIN_COLOR, type PinState } from "@/components/floor-plans/floor-plan-location";
import { EntityPicker } from "@/components/ui/entity-picker";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";

type Plan = {
  id: string;
  name: string;
  siteName: string | null;
  pinCount: number;
  openJobPins: number;
  dots: Array<{ x: number; y: number; state: PinState }>;
};

export default function FloorPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState<string | null>(null);
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
      if (siteId) body.set("siteId", siteId);
      body.set("file", file);
      await apiClient.post("/floor-plans", body);
      toast.success("Floor plan created");
      setCreating(false);
      setName("");
      setSiteId(null);
      setFile(null);
      await load(search);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create the floor plan."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="space-y-4 p-6">
        <PageBreadcrumbs items={[{ label: "Organization", href: "/admin/organization" }, { label: "Floor plans" }]} />
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Floor plans</h1>
            <p className="mt-1 text-sm text-slate-500">Upload a map of a building and pin machines on it, so anyone can find them fast.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search floor plans" aria-label="Search floor plans" className="min-h-10 w-56 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" />
            </div>
            <button type="button" onClick={() => setCreating(true)} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              + Floor plan
            </button>
          </div>
        </header>

        {creating ? (
          <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="New floor plan">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3" placeholder="e.g. Packing hall, ground floor" />
              </label>
              <div className="text-sm">
                <span className="font-medium text-slate-700">Site (optional)</span>
                <div className="mt-1">
                  <EntityPicker endpoint="/organization/sites" placeholder="Search sites…" value={siteId} displayField="name" secondaryField="code" onChange={(id) => setSiteId(id)} />
                </div>
              </div>
            </div>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Image (PNG, JPG or WEBP, up to 3 MB)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void create()} className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </section>
        ) : null}

        {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {!loading && plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-10 text-center">
            <p className="text-base font-semibold text-slate-900">No floor plans yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">Upload a map of a building, pin each machine on it, and technicians can see exactly where a job is.</p>
            <button type="button" onClick={() => setCreating(true)} className="mt-4 min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">+ Floor plan</button>
          </div>
        ) : null}
        {plans.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <li key={plan.id}>
                <Link href={`/floor-plans/${plan.id}` as Route} className="block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm">
                  <div className="relative h-32 bg-slate-100" style={{ backgroundImage: "linear-gradient(#d3dce8 1px,transparent 1px),linear-gradient(90deg,#d3dce8 1px,transparent 1px)", backgroundSize: "24px 24px" }} aria-hidden="true">
                    {plan.dots.map((dot, index) => (
                      <i key={index} className={`absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${PIN_COLOR[dot.state]}`} style={{ left: `${dot.x}%`, top: `${dot.y}%` }} />
                    ))}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-slate-900">{plan.name}</p>
                    <p className="text-xs text-slate-500">
                      {[plan.siteName, `${plan.pinCount} asset${plan.pinCount === 1 ? "" : "s"} pinned`, plan.openJobPins > 0 ? `${plan.openJobPins} with open jobs` : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
