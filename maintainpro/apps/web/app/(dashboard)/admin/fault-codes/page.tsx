"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type AnalysisCode = {
  id: string;
  kind: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

const KINDS = ["FAILURE", "CAUSE", "REMEDY"] as const;

export default function AdminFaultCodesPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("FAILURE");
  const [form, setForm] = useState({ code: "", name: "", description: "", reason: "" });

  const query = useQuery({
    queryKey: withTenantScope(["admin", "analysis-codes", kind]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: AnalysisCode[] }>(
        `/admin/maintenance-config/analysis-codes?kind=${encodeURIComponent(kind)}`
      );
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/admin/maintenance-config/analysis-codes", {
        kind,
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        reason: form.reason || "Admin analysis code update"
      });
    },
    onSuccess: () => {
      toast.success("Analysis code saved");
      setForm({ code: "", name: "", description: "", reason: "" });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "analysis-codes"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Save failed"))
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: AnalysisCode) => {
      await apiClient.post("/admin/maintenance-config/analysis-codes", {
        kind: row.kind,
        code: row.code,
        name: row.name,
        description: row.description ?? undefined,
        isActive: !row.isActive,
        reason: row.isActive ? "Deactivated analysis code" : "Reactivated analysis code"
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "analysis-codes"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading fault codes" description="Fetching analysis masters." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load fault codes"
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
          { label: "Fault / Cause / Remedy" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Fault, Cause & Remedy Codes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Admin-managed failure library used on work order diagnosis. Changes are versioned in
          configuration history.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              kind === k
                ? "bg-brand-600 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-brand-300"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      <form
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
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
            placeholder="e.g. BEARING_FAIL"
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
            placeholder="Bearing failure"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-slate-500" htmlFor="description">
            Description
          </label>
          <input
            id="description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            placeholder="Why is this code being added or updated?"
          />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Save {kind} code
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No codes yet for this kind.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.code}</td>
                  <td className="px-4 py-3 text-slate-900">{row.name}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-brand-700 underline"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(row)}
                    >
                      {row.isActive ? "Active" : "Inactive"}
                    </button>
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
