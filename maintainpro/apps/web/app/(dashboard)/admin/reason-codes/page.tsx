"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type ReasonCode = {
  id: string;
  kind: string;
  code: string;
  name: string;
  description: string | null;
  requiresNotes: boolean;
  sortOrder: number;
  active: boolean;
};

const KINDS = ["HOLD", "DELAY"] as const;

export default function AdminReasonCodesPage() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<string>("HOLD");
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    requiresNotes: false,
    reason: ""
  });

  const query = useQuery({
    queryKey: withTenantScope(["admin", "reason-codes", kind]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: ReasonCode[] }>(
        `/admin/maintenance-config/reason-codes?kind=${encodeURIComponent(kind)}`
      );
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/admin/maintenance-config/reason-codes", {
        kind,
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        requiresNotes: form.requiresNotes,
        reason: form.reason || "Admin reason code update"
      });
    },
    onSuccess: () => {
      toast.success("Reason code saved");
      setForm({ code: "", name: "", description: "", requiresNotes: false, reason: "" });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "reason-codes"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Save failed"))
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: ReasonCode) => {
      await apiClient.post("/admin/maintenance-config/reason-codes", {
        kind: row.kind,
        code: row.code,
        name: row.name,
        description: row.description ?? undefined,
        requiresNotes: row.requiresNotes,
        active: !row.active,
        reason: row.active ? "Deactivated reason code" : "Reactivated reason code"
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "reason-codes"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading reason codes" description="Fetching hold and delay masters." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load reason codes"
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
          { label: "Hold / Delay Reasons" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hold & Delay Reason Codes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Structured reasons for pausing work. Codes marked as requiring notes enforce a comment on
          hold transitions.
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
            placeholder="e.g. WAITING_PARTS"
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
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.requiresNotes}
            onChange={(e) => setForm((f) => ({ ...f, requiresNotes: e.target.checked }))}
          />
          Requires notes when used
        </label>
        <div>
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
            disabled={saveMutation.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Save {kind} reason
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No reason codes yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{row.code}</td>
                  <td className="px-4 py-3 text-slate-900">{row.name}</td>
                  <td className="px-4 py-3">{row.requiresNotes ? "Required" : "Optional"}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-brand-700 underline"
                      disabled={toggleMutation.isPending}
                      onClick={() => toggleMutation.mutate(row)}
                    >
                      {row.active ? "Active" : "Inactive"}
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
