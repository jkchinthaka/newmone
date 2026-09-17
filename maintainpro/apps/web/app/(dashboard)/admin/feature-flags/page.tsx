"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type FeatureFlag = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  currentlyEnabled: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export default function AdminFeatureFlagsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: withTenantScope(["admin", "feature-flags"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: FeatureFlag[] }>(
        "/admin/maintenance-config/feature-flags"
      );
      return res.data.data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (row: FeatureFlag) => {
      await apiClient.post("/admin/maintenance-config/feature-flags", {
        code: row.code,
        enabled: !row.enabled,
        reason: `${row.code} ${row.enabled ? "disabled" : "enabled"} by admin`
      });
    },
    onSuccess: () => {
      toast.success("Feature flag updated");
      void qc.invalidateQueries({ queryKey: withTenantScope(["admin", "feature-flags"]) });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, "Update failed"))
  });

  if (query.isLoading) {
    return <LoadingState title="Loading feature flags" description="Fetching tenant module switches." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load feature flags"
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
          { label: "Feature Flags" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Tenant Feature Flags</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enable or disable modules per tenant. Navigation hides disabled modules; backend still
          enforces permissions and may reject disabled feature usage.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Effective</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.description ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {row.currentlyEnabled ? "In effect" : "Not in effect"}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-brand-700 underline"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(row)}
                  >
                    {row.enabled ? "Enabled" : "Disabled"}
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
