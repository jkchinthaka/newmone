"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type MaintenanceTemplate = {
  id: string;
  code: string;
  name: string;
  jobDomain: string;
  version: number;
  defaultPriority: string;
  estimatedHours: number | null;
  active: boolean;
  instructions: string | null;
};

export default function AdminMaintenanceTemplatesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    code: "",
    name: "",
    jobDomain: "MACHINERY",
    defaultPriority: "MEDIUM",
    estimatedHours: "2",
    instructions: "",
    reason: ""
  });

  const query = useQuery({
    queryKey: withTenantScope(["admin", "maintenance-templates"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: MaintenanceTemplate[] }>(
        "/admin/maintenance-config/maintenance-templates?activeOnly=false"
      );
      return res.data.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/admin/maintenance-config/maintenance-templates", {
        code: form.code,
        name: form.name,
        jobDomain: form.jobDomain,
        defaultPriority: form.defaultPriority,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        instructions: form.instructions || undefined,
        reason: form.reason || "Maintenance template created"
      });
    },
    onSuccess: () => {
      toast.success("Template created");
      setForm((f) => ({ ...f, code: "", name: "", instructions: "", reason: "" }));
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "maintenance-templates"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Create failed"))
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/admin/maintenance-config/maintenance-templates/seed-defaults");
    },
    onSuccess: () => {
      toast.success("Default templates seeded");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "maintenance-templates"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Seed failed"))
  });

  const reviseMutation = useMutation({
    mutationFn: async (tpl: MaintenanceTemplate) => {
      const reason = window.prompt(`Reason for revising ${tpl.code} v${tpl.version}?`, "Template update");
      if (!reason) return;
      await apiClient.post(`/admin/maintenance-config/maintenance-templates/${tpl.id}/revise`, {
        changeReason: reason
      });
    },
    onSuccess: () => {
      toast.success("New template version created — prior WO snapshots stay frozen");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "maintenance-templates"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Revise failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading templates" description="Fetching maintenance templates." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load templates"
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
          { label: "Maintenance Templates" }
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance Templates</h1>
          <p className="mt-1 text-sm text-slate-600">
            Versioned job templates for Machinery, Service, and Vehicle. Applying a template to a
            work order freezes a snapshot so later revisions do not rewrite history.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-brand-300"
          disabled={seedMutation.isPending}
          onClick={() => seedMutation.mutate()}
        >
          Seed defaults
        </button>
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
          <label className="text-xs font-medium text-slate-500" htmlFor="jobDomain">
            Job domain
          </label>
          <select
            id="jobDomain"
            value={form.jobDomain}
            onChange={(e) => setForm((f) => ({ ...f, jobDomain: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="MACHINERY">MACHINERY</option>
            <option value="SERVICE">SERVICE</option>
            <option value="VEHICLE">VEHICLE</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="priority">
            Default priority
          </label>
          <select
            id="priority"
            value={form.defaultPriority}
            onChange={(e) => setForm((f) => ({ ...f, defaultPriority: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="instructions">
            Instructions
          </label>
          <textarea
            id="instructions"
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
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
              <th className="px-4 py-3">Domain</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No templates yet. Seed defaults or create one.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.jobDomain}</td>
                  <td className="px-4 py-3">v{row.version}</td>
                  <td className="px-4 py-3">{row.defaultPriority}</td>
                  <td className="px-4 py-3">{row.active ? "Active" : "Superseded"}</td>
                  <td className="px-4 py-3">
                    {row.active ? (
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
