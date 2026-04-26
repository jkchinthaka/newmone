"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState, PageHeader, Section } from "@/components/farm/farm-ui";
import { farmGet, farmPost } from "@/lib/farm-api";
import { getActiveTenantId } from "@/lib/tenant-context";

type Trace = {
  id: string;
  batchCode: string;
  cropCycleId: string;
  fieldId: string;
  harvestDate: string;
  buyerName?: string | null;
  publicUrl?: string | null;
  certifications: string[];
};

export default function FarmTraceabilityPage() {
  const qc = useQueryClient();
  const tenantId = typeof window !== "undefined" ? getActiveTenantId() ?? "" : "";

  const list = useQuery({ queryKey: ["farm-traceability"], queryFn: () => farmGet<Trace[]>("/farm/traceability") });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cropCycleId: "",
    fieldId: "",
    harvestRecordId: "",
    sprayLogIds: "",
    soilTestId: "",
    harvestDate: new Date().toISOString().slice(0, 10),
    buyerName: "",
    certifications: ""
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => farmPost<Trace>("/farm/traceability", payload),
    onSuccess: () => {
      setShowForm(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ["farm-traceability"] });
    },
    onError: (err: unknown) => setError(String((err as Error)?.message ?? "failed"))
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      tenantId,
      cropCycleId: form.cropCycleId,
      fieldId: form.fieldId,
      harvestRecordId: form.harvestRecordId || undefined,
      soilTestId: form.soilTestId || undefined,
      harvestDate: form.harvestDate,
      buyerName: form.buyerName || undefined,
      sprayLogIds: form.sprayLogIds
        ? form.sprayLogIds.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      certifications: form.certifications
        ? form.certifications.split(",").map((s) => s.trim()).filter(Boolean)
        : []
    };
    create.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Traceability"
        title="Farm-to-Fork Traceability"
        description="Generate batch codes (NF-YYYYMMDD-XXX) with public lookup pages for buyers and regulators."
        actions={
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            {showForm ? "Cancel" : "+ New batch"}
          </button>
        }
      />

      {showForm ? (
        <Section title="Generate batch">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Crop cycle ID *</span>
              <input
                required
                value={form.cropCycleId}
                onChange={(e) => setForm((s) => ({ ...s, cropCycleId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Field ID *</span>
              <input
                required
                value={form.fieldId}
                onChange={(e) => setForm((s) => ({ ...s, fieldId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Harvest record ID</span>
              <input
                value={form.harvestRecordId}
                onChange={(e) => setForm((s) => ({ ...s, harvestRecordId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Soil test ID</span>
              <input
                value={form.soilTestId}
                onChange={(e) => setForm((s) => ({ ...s, soilTestId: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Harvest date *</span>
              <input
                type="date"
                required
                value={form.harvestDate}
                onChange={(e) => setForm((s) => ({ ...s, harvestDate: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
              <span>Buyer name</span>
              <input
                value={form.buyerName}
                onChange={(e) => setForm((s) => ({ ...s, buyerName: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
              <span>Spray log IDs (comma-separated)</span>
              <input
                value={form.sprayLogIds}
                onChange={(e) => setForm((s) => ({ ...s, sprayLogIds: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
              <span>Certifications (comma-separated)</span>
              <input
                value={form.certifications}
                onChange={(e) => setForm((s) => ({ ...s, certifications: e.target.value }))}
                placeholder="GAP, ORGANIC, GLOBALG.A.P."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={!tenantId || create.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {create.isPending ? "Generating…" : "Generate batch"}
              </button>
              {error ? <span className="text-xs text-rose-600">{error}</span> : null}
            </div>
          </form>
        </Section>
      ) : null}

      <Section title="Issued batches">
        {list.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !list.data?.length ? (
          <EmptyState title="No batches yet" description="Generate your first batch code above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Batch</th>
                  <th className="px-3 py-2 text-left">Harvest date</th>
                  <th className="px-3 py-2 text-left">Buyer</th>
                  <th className="px-3 py-2 text-left">Certs</th>
                  <th className="px-3 py-2 text-left">Public link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {list.data.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-mono text-xs">{t.batchCode}</td>
                    <td className="px-3 py-2">{new Date(t.harvestDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{t.buyerName ?? "—"}</td>
                    <td className="px-3 py-2">{t.certifications.join(", ") || "—"}</td>
                    <td className="px-3 py-2">
                      {t.publicUrl ? (
                        <a
                          href={t.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 underline"
                        >
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
