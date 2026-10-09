"use client";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState, PermissionState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { apiClient } from "@/lib/api-client";
import { extractRoleName } from "@/lib/role-redirect";
import {
  compactSystemHealthRows,
  configurationWarnings,
  HEALTH_STATUS_LABELS,
  type HealthCheckInput,
  type HealthCheckStatus
} from "@/lib/system-health-view";
import { useCurrentUser } from "@/lib/use-current-user";

type SystemHealth = {
  status: "operational" | "degraded";
  timestamp: string;
  dependencies: HealthCheckInput[];
  configuration: HealthCheckInput[];
};

type ApiEnvelope<T> = {
  data: T;
};

const statusClass: Record<HealthCheckStatus, string> = {
  operational: "text-emerald-700",
  degraded: "text-amber-700",
  failed: "text-rose-700",
  mock: "text-amber-700",
  misconfigured: "text-rose-700",
  unconfigured: "text-slate-600",
  disabled: "text-slate-500",
  unavailable: "text-slate-500"
};

function formatTime(value?: string) {
  if (!value) return "Not reported";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function SystemHealthPage() {
  const user = useCurrentUser();
  const allowed = extractRoleName(user) === "SUPER_ADMIN";
  const healthQuery = useQuery({
    queryKey: ["system-health"],
    enabled: allowed,
    queryFn: async () => {
      const response = await apiClient.get<ApiEnvelope<SystemHealth>>("/health/readiness");
      return response.data.data;
    },
    refetchInterval: allowed ? 60_000 : false,
    staleTime: 15_000
  });

  if (!allowed) {
    return (
      <div className="ops-page">
        <PageBreadcrumbs />
        <PermissionState
          title="Technical administrator access required"
          description="System Health is limited to superadmins. Health checks, provider configuration, and deployment diagnostics remain available to those accounts and to existing operations workflows."
        />
      </div>
    );
  }

  const checks = [...(healthQuery.data?.dependencies ?? []), ...(healthQuery.data?.configuration ?? [])];
  const rows = healthQuery.data ? compactSystemHealthRows(checks, healthQuery.data.status) : [];
  const warnings = configurationWarnings(checks);

  return (
    <div className="ops-page">
      <PageBreadcrumbs />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">System Health</h1>
          <p className="mt-1 text-sm text-slate-600">
            Last check {formatTime(healthQuery.data?.timestamp)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void healthQuery.refetch()}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-70"
          disabled={healthQuery.isFetching}
        >
          <RefreshCw size={14} className={healthQuery.isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </header>

      {healthQuery.isLoading && !healthQuery.data ? (
        <LoadingState title="Checking system health" description="Loading the latest dependency status." />
      ) : null}

      {healthQuery.error ? (
        <ErrorState
          error={healthQuery.error}
          onRetry={() => void healthQuery.refetch()}
          title="Could not load system health"
          description={toSafeApiErrorMessage(healthQuery.error, "Unable to load system health.")}
        />
      ) : null}

      {healthQuery.data ? (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.label}</td>
                  <td className={`px-3 py-2 ${statusClass[row.status]}`}>{HEALTH_STATUS_LABELS[row.status]}</td>
                  <td className="px-3 py-2 text-slate-600">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-sm font-semibold text-amber-950">Configuration warnings</h2>
          <ul className="mt-2 space-y-2">
            {warnings.map((warning) => (
              <li key={warning.key} className="text-sm text-amber-950">
                <span className="font-medium">{warning.label}.</span> {warning.detail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
