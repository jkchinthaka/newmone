"use client";

import { useState } from "react";
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
  const [pending, setPending] = useState<FeatureFlag | null>(null);
  const [reason, setReason] = useState("");
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
    mutationFn: async (input: { row: FeatureFlag; reason: string }) => {
      await apiClient.post("/admin/maintenance-config/feature-flags", {
        code: input.row.code,
        enabled: !input.row.enabled,
        reason: input.reason.trim()
      });
    },
    onSuccess: () => {
      toast.success("Feature flag updated");
      setPending(null);
      setReason("");
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
        <h1 className="page-title">Tenant Feature Flags</h1>
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
                    onClick={() => {
                      setPending(row);
                      setReason("");
                    }}
                  >
                    {row.enabled ? "Enabled" : "Disabled"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pending ? (
        <form
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length < 5) return;
            saveMutation.mutate({ row: pending, reason });
          }}
        >
          <h2 className="font-semibold">Change {pending.code}?</h2>
          <p className="text-sm text-slate-600">
            This {pending.enabled ? "turns off" : "turns on"} {pending.name}. Navigation hides a disabled module. The API still checks permissions.
          </p>
          <label className="block text-sm">
            Reason
            <input
              required
              minLength={5}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="min-h-11 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white" disabled={reason.trim().length < 5 || saveMutation.isPending}>
              Confirm
            </button>
            <button type="button" className="min-h-11 rounded-lg border px-3 text-sm" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
