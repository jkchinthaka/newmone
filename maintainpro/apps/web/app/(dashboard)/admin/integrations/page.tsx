"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type IntegrationStatus = {
  status: string;
  label: string;
  detail?: string;
};

export default function AdminIntegrationsPage() {
  const query = useQuery({
    queryKey: withTenantScope(["admin", "integrations-status"]),
    queryFn: async () => {
      const res = await apiClient.get<{ data: Record<string, IntegrationStatus> }>(
        "/admin/maintenance-config/integrations-status"
      );
      return res.data.data;
    }
  });

  if (query.isLoading) {
    return <LoadingState title="Loading integrations" description="Checking readiness." />;
  }

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="Unable to load integrations"
        description={getApiErrorMessage(query.error, "Request failed")}
        onRetry={() => query.refetch()}
      />
    );
  }

  const entries = Object.entries(query.data);

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Admin", href: "/admin" }, { label: "Integrations" }]} />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Readiness of ERP, messaging, storage, and infrastructure. Credentials are never shown.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{value.label}</p>
            <p className="mt-1 text-xs text-slate-500">{value.status}</p>
            {value.detail ? <p className="mt-2 text-sm text-slate-600">{value.detail}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
