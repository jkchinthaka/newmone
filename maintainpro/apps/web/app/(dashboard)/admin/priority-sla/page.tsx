"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type PriorityRule = {
  id: string;
  priority: string;
  responseMinutes: number | null;
  completionMinutes: number | null;
  escalateOnBreach: boolean;
  notifyOnBreach: boolean;
  active: boolean;
};

function formatMinutes(mins: number | null) {
  if (mins == null) return "—";
  if (mins < 60) return `${mins} min`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / (24 * 60))} d`;
}

export default function AdminPrioritySlaPage() {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, PriorityRule>>({});
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: withTenantScope(["admin", "priority-sla"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: PriorityRule[] }>("/admin/maintenance-config/priority-sla");
      return res.data.data;
    }
  });

  useEffect(() => {
    if (!query.data) return;
    const next: Record<string, PriorityRule> = {};
    for (const rule of query.data) {
      next[rule.id] = { ...rule };
    }
    setDrafts(next);
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: async (rule: PriorityRule) => {
      await apiClient.post("/admin/maintenance-config/priority-sla", {
        priority: rule.priority,
        responseMinutes: rule.responseMinutes,
        completionMinutes: rule.completionMinutes,
        escalateOnBreach: rule.escalateOnBreach,
        notifyOnBreach: rule.notifyOnBreach,
        active: rule.active,
        reason: reason.trim() || "Priority SLA configuration change"
      });
    },
    onSuccess: () => {
      toast.success("Priority SLA saved — work-order deadlines use these targets");
      setReason("");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "priority-sla"]) });
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "config-history"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Save failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading priority rules" description="Fetching SLA targets." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load priority SLA"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const rules = query.data ?? [];

  return (
    <div className="space-y-6">
      <PageBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Maintenance Configuration", href: "/admin/maintenance-config" },
          { label: "Priority / SLA" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Priority / SLA Rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Response and completion targets drive work-order SLA deadlines when a job starts. Changes
          are recorded in configuration history.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500" htmlFor="sla-reason">
          Change reason (applied on save)
        </label>
        <input
          id="sla-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full max-w-xl rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="e.g. Reduce CRITICAL completion to 30 minutes for cold-room emergencies"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Response (min)</th>
              <th className="px-4 py-3">Completion (min)</th>
              <th className="px-4 py-3">Display</th>
              <th className="px-4 py-3">Escalate</th>
              <th className="px-4 py-3">Notify</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => {
              const draft = drafts[rule.id] ?? rule;
              return (
                <tr key={rule.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={draft.responseMinutes ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        setDrafts((d) => ({
                          ...d,
                          [rule.id]: { ...draft, responseMinutes: v }
                        }));
                      }}
                      className="w-24 rounded border border-slate-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={1}
                      value={draft.completionMinutes ?? ""}
                      onChange={(e) => {
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        setDrafts((d) => ({
                          ...d,
                          [rule.id]: { ...draft, completionMinutes: v }
                        }));
                      }}
                      className="w-24 rounded border border-slate-200 px-2 py-1"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatMinutes(draft.responseMinutes)} / {formatMinutes(draft.completionMinutes)}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={draft.escalateOnBreach}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [rule.id]: { ...draft, escalateOnBreach: e.target.checked }
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={draft.notifyOnBreach}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [rule.id]: { ...draft, notifyOnBreach: e.target.checked }
                        }))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-brand-700 underline"
                      disabled={saveMutation.isPending}
                      onClick={() =>
                        saveMutation.mutate({ ...draft, active: !draft.active })
                      }
                    >
                      {draft.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={saveMutation.isPending}
                      className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      onClick={() => saveMutation.mutate(draft)}
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
