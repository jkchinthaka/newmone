"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

const ITEM_TYPES = [
  "CHECKBOX",
  "PASS_FAIL",
  "YES_NO",
  "NUMERIC",
  "TEXT",
  "PHOTO",
  "DROPDOWN",
  "METER_READING",
  "SIGNATURE"
] as const;

export default function AdminChecklistTemplatesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    domainKey: "MACHINERY",
    reason: "",
    itemKey: "item_1",
    itemLabel: "",
    itemType: "PASS_FAIL"
  });

  const query = useQuery({
    queryKey: withTenantScope(["admin", "checklist-templates"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ChecklistTemplate[] }>(
        "/planning/checklist-templates?activeOnly=false"
      );
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/planning/checklist-templates", {
        code: form.code,
        name: form.name,
        domainKey: form.domainKey || undefined,
        reason: form.reason || "Checklist template created",
        items: form.itemLabel
          ? [
              {
                key: form.itemKey || "item_1",
                label: form.itemLabel,
                type: form.itemType,
                required: true,
                sortOrder: 0
              }
            ]
          : []
      });
    },
    onSuccess: () => {
      toast.success("Checklist template created");
      setForm((f) => ({ ...f, code: "", name: "", itemLabel: "", reason: "" }));
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "checklist-templates"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  const reviseMutation = useMutation({
    mutationFn: async (tpl: ChecklistTemplate) => {
      const reason = window.prompt(
        `Reason for revising ${tpl.code} v${tpl.version}?`,
        "Template content update"
      );
      if (!reason) return;
      await apiClient.put(`/planning/checklist-templates/${tpl.id}/revise`, {
        changeReason: reason,
        items: tpl.items.map((item) => ({
          key: item.key,
          label: item.label,
          type: item.type,
          required: item.required,
          sortOrder: item.sortOrder,
          unit: item.unit ?? undefined
        }))
      });
    },
    onSuccess: () => {
      toast.success("New template version created — prior executions keep their snapshot");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "checklist-templates"]) });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "config-history"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Revise failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading checklist templates" description="Fetching versioned templates." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load checklist templates"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance Configuration", href: "/admin/maintenance-config" },
          { label: "Checklist Templates" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Checklist Templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Versioned checklists for PM and work orders. Starting a checklist freezes the template
          snapshot so later revisions do not change historical results.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="code">
            Code
          </label>
          <input
            id="code"
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="GEN-MONTHLY"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="domainKey">
            Domain
          </label>
          <select
            id="domainKey"
            value={form.domainKey}
            onChange={(e) => setForm((f) => ({ ...f, domainKey: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="MACHINERY">MACHINERY</option>
            <option value="SERVICE">SERVICE</option>
            <option value="VEHICLE">VEHICLE</option>
            <option value="">General</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="itemType">
            First item type
          </label>
          <select
            id="itemType"
            value={form.itemType}
            onChange={(e) => setForm((f) => ({ ...f, itemType: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="itemLabel">
            First checklist item (optional)
          </label>
          <input
            id="itemLabel"
            value={form.itemLabel}
            onChange={(e) => setForm((f) => ({ ...f, itemLabel: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Oil level check"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="reason">
            Change reason
          </label>
          <input
            id="reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Create template
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No checklist templates yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                  <td className="px-4 py-3">v{row.version}</td>
                  <td className="px-4 py-3">{row.domainKey ?? "—"}</td>
                  <td className="px-4 py-3">{row.items?.length ?? 0}</td>
                  <td className="px-4 py-3">{row.isActive ? "Active" : "Superseded"}</td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <button
                        type="button"
                        className="text-brand-700 underline"
                        disabled={reviseMutation.isPending}
                        onClick={() => reviseMutation.mutate(row)}
                      >
                        Revise
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
