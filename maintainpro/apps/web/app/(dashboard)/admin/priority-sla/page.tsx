"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const query = useQuery({
    queryKey: withTenantScope(["admin", "priority-sla"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: PriorityRule[] }>("/admin/maintenance-config/priority-sla");
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: PriorityRule) => {
      await apiClient.post("/admin/maintenance-config/priority-sla", {
        priority: rule.priority,
        responseMinutes: rule.responseMinutes,
        completionMinutes: rule.completionMinutes,
        escalateOnBreach: rule.escalateOnBreach,
        notifyOnBreach: rule.notifyOnBreach,
        active: rule.active
      });
    },
    onSuccess: () => {
      toast.success("Priority SLA saved");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "priority-sla"]) });
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
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Priority / SLA" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Priority / SLA Rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Target response and completion times by priority. Escalation and notification flags
          guide operations — this is not a full BPM engine.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Response</th>
              <th className="px-4 py-3">Completion</th>
              <th className="px-4 py-3">Escalate</th>
              <th className="px-4 py-3">Notify</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{rule.priority}</td>
                <td className="px-4 py-3">{formatMinutes(rule.responseMinutes)}</td>
                <td className="px-4 py-3">{formatMinutes(rule.completionMinutes)}</td>
                <td className="px-4 py-3">{rule.escalateOnBreach ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{rule.notifyOnBreach ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-brand-700 underline"
                    disabled={saveMutation.isPending}
                    onClick={() =>
                      saveMutation.mutate({ ...rule, active: !rule.active })
                    }
                  >
                    {rule.active ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
