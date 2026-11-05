"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type ChecklistItem = {
  id?: string;
  key: string;
  label: string;
  type: string;
  required: boolean;
  sortOrder: number;
  unit?: string | null;
};

type ChecklistTemplate = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: number;
  domainKey: string | null;
  isActive: boolean;
  items: ChecklistItem[];
  _count?: { pmPlans: number; inspectionTemplates: number };
};

const ITEM_TYPES: Array<{ value: string; label: string }> = [
  { value: "PASS_FAIL", label: "Pass / Fail" },
  { value: "CHECKBOX", label: "Tick box" },
  { value: "YES_NO", label: "Yes / No" },
  { value: "NUMERIC", label: "Number" },
  { value: "METER_READING", label: "Meter reading" },
  { value: "TEXT", label: "Text" },
  { value: "DROPDOWN", label: "Choose from list" },
  { value: "PHOTO", label: "Photo" },
  { value: "SIGNATURE", label: "Signature" }
];

const DOMAINS: Array<{ value: string; label: string }> = [
  { value: "MACHINERY", label: "Machinery" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "SERVICE", label: "Service" },
  { value: "", label: "General" }
];

const domainLabel = (key: string | null) => (key ? DOMAINS.find((d) => d.value === key)?.label ?? key : "Not set");

type DraftStep = { key: string; label: string; type: string; required: boolean; unit?: string | null };

function slug(text: string, fallback: string) {
  const base = text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return base || fallback;
}

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100";

export default function AdminChecklistTemplatesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChecklistTemplate | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [domainKey, setDomainKey] = useState("MACHINERY");
  const [reason, setReason] = useState("");
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);

  const query = useQuery({
    queryKey: withTenantScope(["admin", "checklist-templates"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ChecklistTemplate[] }>(
        "/planning/checklist-templates?activeOnly=false"
      );
      return res.data.data;
    }
  });

  function openNew() {
    setEditing(null);
    setName("");
    setCode("");
    setDomainKey("MACHINERY");
    setReason("");
    setSteps([{ key: "", label: "", type: "PASS_FAIL", required: true }]);
    setDialogOpen(true);
  }

  function openEdit(tpl: ChecklistTemplate) {
    setEditing(tpl);
    setName(tpl.name);
    setCode(tpl.code);
    setDomainKey(tpl.domainKey ?? "");
    setReason("");
    setSteps(
      [...(tpl.items ?? [])]
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map((item) => ({ key: item.key, label: item.label, type: item.type, required: item.required, unit: item.unit }))
    );
    setDialogOpen(true);
  }

  function buildItems() {
    const used = new Set<string>();
    return steps
      .filter((step) => step.label.trim())
      .map((step, index) => {
        let key = step.key || slug(step.label, `item_${index + 1}`);
        while (used.has(key)) key = `${key}_${index + 1}`;
        used.add(key);
        return { key, label: step.label.trim(), type: step.type, required: step.required, sortOrder: index, unit: step.unit ?? undefined };
      });
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items = buildItems();
      if (editing) {
        await apiClient.put(`/planning/checklist-templates/${editing.id}/revise`, {
          changeReason: reason.trim(),
          items
        });
      } else {
        await apiClient.post("/planning/checklist-templates", {
          code: code.trim() || `${slug(name, "procedure").toUpperCase().replace(/_/g, "-").slice(0, 20)}-${Date.now().toString(36).slice(-4).toUpperCase()}`,
          name: name.trim(),
          domainKey: domainKey || undefined,
          reason: "Procedure created",
          items
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "New version saved. Finished jobs keep the version they used." : "Procedure created");
      setDialogOpen(false);
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "checklist-templates"]) });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "config-history"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Could not save the procedure."))
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (row) =>
        (!domainFilter || (row.domainKey ?? "") === domainFilter) &&
        (!q || row.name.toLowerCase().includes(q) || row.code.toLowerCase().includes(q))
    );
  }, [query.data, search, domainFilter]);

  if (query.isLoading) {
    return <LoadingState title="Loading procedures" description="Fetching versioned procedures." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load procedures"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const total = query.data?.length ?? 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Enter a name for the procedure.");
    if (buildItems().length === 0) return toast.error("Add at least one step.");
    if (editing && !reason.trim()) return toast.error("Say what changed.");
    saveMutation.mutate();
  }

  const updateStep = (index: number, patch: Partial<DraftStep>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  const moveStep = (index: number, delta: number) =>
    setSteps((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance Configuration", href: "/admin/maintenance-config" },
          { label: "Procedures" }
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Procedures</h1>
          <p className="mt-1 text-sm text-slate-600">
            Reusable step-by-step checklists for jobs and scheduled service. Editing creates a new version; finished jobs keep the version they used.
          </p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={14} aria-hidden /> New procedure
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          aria-label="Search procedures"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        {[{ value: null, label: `All ${total}` }, ...DOMAINS.filter((d) => d.value).map((d) => ({ value: d.value, label: d.label }))].map((chip) => (
          <button
            key={chip.label}
            type="button"
            aria-pressed={domainFilter === chip.value}
            onClick={() => setDomainFilter(chip.value)}
            className={`rounded-full border px-3 py-1 text-xs ${domainFilter === chip.value ? "border-brand-600 bg-brand-600 font-semibold text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Steps</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  {total === 0 ? "No procedures yet. Use “New procedure” to create one." : "No procedures match your search."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs">{row.code}</span></td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{domainLabel(row.domainKey)}</td>
                  <td className="px-4 py-3">{row.items?.length ?? 0}</td>
                  <td className="px-4 py-3">v{row.version}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {row.isActive ? "Active" : "Superseded"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.isActive ? (
                      <button type="button" className="rounded-lg border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="presentation">
          <form
            role="dialog"
            aria-modal="true"
            aria-label={editing ? `Edit ${editing.code}` : "New procedure"}
            onSubmit={submit}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? `Edit ${editing.name}` : "New procedure"}</h2>
              <button type="button" onClick={() => setDialogOpen(false)} aria-label="Close" className="rounded-full border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"><X size={14} /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Name <span className="text-red-600">*</span>
                  <input required className={INPUT} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly pump check" disabled={Boolean(editing)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Code
                  <input className={`${INPUT} font-mono`} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Made from the name if empty" disabled={Boolean(editing)} />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Applies to
                  <select className={INPUT} value={domainKey} onChange={(e) => setDomainKey(e.target.value)} disabled={Boolean(editing)}>
                    {DOMAINS.map((d) => <option key={d.label} value={d.value}>{d.label}</option>)}
                  </select>
                </label>
                {editing ? (
                  <label className="block text-sm font-medium text-slate-700">
                    What changed? <span className="text-red-600">*</span>
                    <input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Added bearing check" />
                  </label>
                ) : null}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Checklist steps</p>
                <ul className="mt-2 space-y-2">
                  {steps.map((step, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
                      <span className="w-5 text-center text-xs text-slate-400">{index + 1}</span>
                      <input
                        aria-label={`Step ${index + 1}`}
                        value={step.label}
                        onChange={(e) => updateStep(index, { label: e.target.value })}
                        placeholder="e.g. Oil level check"
                        className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <select aria-label={`Answer type for step ${index + 1}`} value={step.type} onChange={(e) => updateStep(index, { type: e.target.value })} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
                        {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => moveStep(index, -1)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button type="button" aria-label="Move down" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button type="button" aria-label={`Remove step ${index + 1}`} onClick={() => setSteps((current) => current.filter((_, i) => i !== index))} className="rounded p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600"><X size={14} /></button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setSteps((current) => [...current, { key: "", label: "", type: "PASS_FAIL", required: true }])} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-slate-50">
                  <Plus size={14} aria-hidden /> Add step
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={() => setDialogOpen(false)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">Cancel</button>
              <button type="submit" disabled={saveMutation.isPending} className="h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {saveMutation.isPending ? "Saving…" : editing ? "Save new version" : "Create procedure"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
