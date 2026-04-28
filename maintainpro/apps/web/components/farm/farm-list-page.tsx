"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { farmGet, farmPost } from "@/lib/farm-api";
import { getActiveTenantId } from "@/lib/tenant-context";
import { EmptyState, PageHeader, Section } from "@/components/farm/farm-ui";

export type FarmField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "textarea" | "select";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  step?: string;
  placeholder?: string;
};

export type FarmColumn<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
};

export function FarmListPage<T extends { id: string }>({
  eyebrow,
  title,
  description,
  endpoint,
  queryKey,
  columns,
  fields,
  defaultValues,
  transformPayload
}: {
  eyebrow: string;
  title: string;
  description?: string;
  endpoint: string;
  queryKey: string;
  columns: FarmColumn<T>[];
  fields: FarmField[];
  defaultValues?: Record<string, string | number>;
  transformPayload?: (raw: Record<string, unknown>) => Record<string, unknown>;
}) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) init[f.name] = String(defaultValues?.[f.name] ?? "");
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  const list = useQuery({
    queryKey: [queryKey],
    queryFn: () => farmGet<T[]>(endpoint)
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => farmPost<T>(endpoint, payload),
    onSuccess: () => {
      setShowForm(false);
      const reset: Record<string, string> = {};
      for (const f of fields) reset[f.name] = String(defaultValues?.[f.name] ?? "");
      setForm(reset);
      setError(null);
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as Error)?.message ??
        "Request failed";
      setError(String(msg));
    }
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = form[f.name];
      if (raw === "" || raw === undefined) continue;
      if (f.type === "number") {
        payload[f.name] = Number(raw);
      } else if (f.type === "date" || f.type === "datetime-local") {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) {
          setError(`Invalid value for ${f.label}`);
          return;
        }
        payload[f.name] = d.toISOString();
      } else {
        payload[f.name] = raw;
      }
    }
    const tenantId = getActiveTenantId();
    if (tenantId && !("tenantId" in payload)) payload.tenantId = tenantId;
    create.mutate(transformPayload ? transformPayload(payload) : payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            {showForm ? "Cancel" : "+ New entry"}
          </button>
        }
      />

      {showForm ? (
        <Section title="Create new">
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f.name} className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                <span>
                  {f.label}
                  {f.required ? <span className="text-rose-500"> *</span> : null}
                </span>
                {f.type === "textarea" ? (
                  <textarea
                    required={f.required}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                ) : f.type === "select" ? (
                  <select
                    required={f.required}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">— Select —</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type ?? "text"}
                    required={f.required}
                    step={f.step}
                    placeholder={f.placeholder}
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  />
                )}
              </label>
            ))}
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={create.isPending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {create.isPending ? "Saving…" : "Save"}
              </button>
              {error ? <span className="text-xs text-rose-600">{error}</span> : null}
            </div>
          </form>
        </Section>
      ) : null}

      <Section title={`${title} — records`}>
        {list.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : list.isError ? (
          <p className="text-sm text-rose-600">Failed to load.</p>
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState title="No records yet" description="Use the New entry button to add one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th key={String(c.key)} className="px-3 py-2 text-left font-semibold">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {list.data.map((row) => (
                  <tr key={row.id}>
                    {columns.map((c) => (
                      <td key={String(c.key)} className="px-3 py-2 text-slate-700">
                        {c.render ? c.render(row) : String((row as Record<string, unknown>)[String(c.key)] ?? "—")}
                      </td>
                    ))}
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
