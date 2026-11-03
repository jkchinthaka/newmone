"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { DepartmentSelect } from "@/components/departments/department-select";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ButtonSpinner } from "@/components/ui/loading";
import { PermissionState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import {
  ASSET_IMPORTANCE_OPTIONS,
  ASSET_REGISTER_STEPS,
  ASSET_REGISTER_TYPES,
  EMPTY_ASSET_REGISTER_FORM,
  assetRegisterPayload,
  assetRegisterStepIssues,
  type AssetRegisterForm
} from "@/lib/asset-register-flow";
import { listLocations, listSites, type OrgLocation, type OrgSite } from "@/lib/organization-api";
import { useCurrentUser } from "@/lib/use-current-user";

const field = "mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm";

export default function RegisterAssetPage() {
  const user = useCurrentUser();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<AssetRegisterForm>(EMPTY_ASSET_REGISTER_FORM);
  const [sites, setSites] = useState<OrgSite[]>([]);
  const [locations, setLocations] = useState<OrgLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; assetTag: string } | null>(null);
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const set = <K extends keyof AssetRegisterForm>(key: K, value: AssetRegisterForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!isAdmin) return;
    void listSites({ includeInactive: false }).then(setSites).catch(() => setSites([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!form.siteId) {
      setLocations([]);
      return;
    }
    void listLocations({ siteId: form.siteId }).then(setLocations).catch(() => setLocations([]));
  }, [form.siteId]);

  // Suggest the next free tag for the chosen type (the user may still change it).
  useEffect(() => {
    if (!form.category || !isAdmin) return;
    let cancelled = false;
    void apiClient
      .get("/assets/next-tag", { params: { category: form.category } })
      .then((response) => {
        const tag = (response.data?.data as { assetTag?: string } | undefined)?.assetTag;
        if (!cancelled && tag) setForm((current) => ({ ...current, assetTag: tag }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [form.category, isAdmin]);

  const issues = useMemo(() => assetRegisterStepIssues(step, form), [step, form]);
  const last = ASSET_REGISTER_STEPS.length - 1;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await apiClient.post("/assets", assetRegisterPayload(form));
      const asset = response.data?.data as { id: string; assetTag: string };
      setCreated({ id: asset.id, assetTag: asset.assetTag });
    } catch (cause) {
      setError(getApiErrorMessage(cause, "The asset could not be registered."));
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 p-4">
        <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Add Machine" }]} />
        <PermissionState title="Admin access required" description="Only an Admin can register machines and equipment." />
      </div>
    );
  }

  if (created) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 size={18} aria-hidden /> {created.assetTag} saved as a draft
          </p>
          <p>Next: a manager opens it on Machines &amp; Equipment and chooses <strong>Approve — make Active</strong>. After that, print its QR label and jobs can be raised on it.</p>
          <div className="flex flex-wrap gap-3">
            <Link className="font-medium underline" href={`/assets?asset=${encodeURIComponent(created.id)}` as Route}>
              Open the asset
            </Link>
            <button
              type="button"
              className="font-medium underline"
              onClick={() => {
                setCreated(null);
                setForm(EMPTY_ASSET_REGISTER_FORM);
                setStep(0);
              }}
            >
              Register another
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Add Machine" }]} />
      <header>
        <h1 className="page-title">Add machine or equipment</h1>
        <p className="mt-1 text-sm text-slate-600">It is saved as a draft. A manager approves it before jobs can use it.</p>
      </header>

      <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="Register steps">
        {ASSET_REGISTER_STEPS.map((label, index) => (
          <li key={label} className={`rounded-full px-3 py-1 ${index === step ? "bg-brand-600 font-semibold text-white" : index < step ? "bg-brand-100 text-brand-800" : "bg-slate-100 text-slate-500"}`}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        {step === 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSET_REGISTER_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                aria-pressed={form.category === type.value}
                onClick={() => set("category", type.value)}
                className={`min-h-16 rounded-xl border p-3 text-left ${form.category === type.value ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50"}`}
              >
                <span className="block font-semibold text-slate-900">{type.label}</span>
                <span className="block text-xs text-slate-600">{type.help}</span>
              </button>
            ))}
            <Link href={"/admin/vehicles/new" as Route} className="min-h-16 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-700 hover:bg-slate-50">
              <span className="block font-semibold">Vehicle?</span>
              <span className="block text-xs text-slate-600">Vehicles are added on Add Vehicle.</span>
            </Link>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Name *<input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Vacuum filler line 2" /></label>
            <label className="text-sm">Asset tag *<input className={field} value={form.assetTag} onChange={(e) => set("assetTag", e.target.value.toUpperCase())} /><span className="text-xs text-slate-500">Suggested automatically. Printed on the QR label.</span></label>
            <label className="text-sm">Serial number<input className={field} value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></label>
            <label className="text-sm">Make (manufacturer)<input className={field} value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></label>
            <label className="text-sm">Model<input className={field} value={form.model} onChange={(e) => set("model", e.target.value)} /></label>
            <label className="text-sm sm:col-span-2">Notes<textarea className={`${field} min-h-20 py-2`} value={form.description} onChange={(e) => set("description", e.target.value)} /></label>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Site *
              <select className={field} value={form.siteId} onChange={(e) => setForm((c) => ({ ...c, siteId: e.target.value, functionalLocationId: "" }))}>
                <option value="">Choose a site</option>
                {sites.map((site) => <option key={site.id} value={site.id}>{site.name} ({site.code})</option>)}
              </select>
              {sites.length === 0 ? <span className="text-xs text-amber-800">No sites yet. Add one in Organization first.</span> : null}
            </label>
            <label className="text-sm">Building / area
              <select className={field} value={form.functionalLocationId} disabled={!form.siteId} onChange={(e) => set("functionalLocationId", e.target.value)}>
                <option value="">Not set</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}
              </select>
            </label>
            <DepartmentSelect value={form.departmentId} onChange={(departmentId) => set("departmentId", departmentId)} label="Owner department" />
            <label className="text-sm">How important
              <select className={field} value={form.criticalityLevel} onChange={(e) => set("criticalityLevel", e.target.value)}>
                {ASSET_IMPORTANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Purchase date<input type="date" className={field} value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></label>
            <label className="text-sm">Purchase price (LKR)<input inputMode="decimal" className={field} value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} /></label>
            <label className="text-sm">Supplier<input className={field} value={form.supplier} onChange={(e) => set("supplier", e.target.value)} /></label>
            <label className="text-sm">Warranty ends<input type="date" className={field} value={form.warrantyExpiry} onChange={(e) => set("warrantyExpiry", e.target.value)} /></label>
            <label className="text-sm">In use since<input type="date" className={field} value={form.commissionedAt} onChange={(e) => set("commissionedAt", e.target.value)} /></label>
            <label className="text-sm">Meter now (hours / km)<input inputMode="decimal" className={field} value={form.meterReading} onChange={(e) => set("meterReading", e.target.value)} /></label>
            <label className="text-sm">Next service date<input type="date" className={field} value={form.nextServiceDate} onChange={(e) => set("nextServiceDate", e.target.value)} /></label>
          </div>
        ) : null}

        {step === last ? (
          <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Type</dt><dd className="font-medium">{ASSET_REGISTER_TYPES.find((t) => t.value === form.category)?.label ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{form.name || "—"}</dd></div>
            <div><dt className="text-slate-500">Asset tag</dt><dd className="font-medium">{form.assetTag || "—"}</dd></div>
            <div><dt className="text-slate-500">Site</dt><dd className="font-medium">{sites.find((s) => s.id === form.siteId)?.name ?? "—"}</dd></div>
            <div><dt className="text-slate-500">How important</dt><dd className="font-medium">{ASSET_IMPORTANCE_OPTIONS.find((o) => o.value === form.criticalityLevel)?.label ?? "—"}</dd></div>
            <div><dt className="text-slate-500">Status after saving</dt><dd className="font-medium">Draft (waiting for manager approval)</dd></div>
          </dl>
        ) : null}

        {issues.length ? (
          <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" aria-live="polite">
            {issues.map((issue) => <li key={issue}>• {issue}</li>)}
          </ul>
        ) : null}
        {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

        <div className="flex justify-between gap-2">
          <button type="button" disabled={step === 0 || saving} onClick={() => setStep((s) => s - 1)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm disabled:opacity-40">Back</button>
          {step < last ? (
            <button type="button" disabled={issues.length > 0} onClick={() => setStep((s) => s + 1)} className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">Next</button>
          ) : (
            <button
              type="button"
              disabled={saving || [0, 1, 2, 3].some((index) => assetRegisterStepIssues(index, form).length > 0)}
              onClick={() => void save()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {saving ? <ButtonSpinner /> : null} Save as draft
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
