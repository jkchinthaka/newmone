"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, LoadingState } from "@/components/ui/page-state";
import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { withTenantScope } from "@/lib/tenant-query";

type HistoryRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  reason: string | null;
  version: number;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export default function AdminConfigHistoryPage() {
  const [entityType, setEntityType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const query = useQuery({
    queryKey: withTenantScope(["admin", "config-history", entityType]),
    queryFn: async () => {
      const qs = new URLSearchParams({ limit: "100" });
      if (entityType) qs.set("entityType", entityType);
      const res = await apiClient.get<{ data: HistoryRow[] }>(
        `/admin/maintenance-config/config-history?${qs.toString()}`
      );
      return res.data.data;
    }
  });

  if (query.isLoading) {
    return (
      <LoadingState title="Loading configuration history" description="Fetching policy change trail." />
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Unable to load configuration history"
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
          { label: "Configuration History" }
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Configuration Change History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Append-only trail of Admin master-data and policy changes (actor, version, before/after).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-medium text-slate-500" htmlFor="entityType">
            Entity type filter
          </label>
          <select
            id="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">All</option>
            <option value="PrioritySlaRule">Priority SLA</option>
            <option value="MaintenanceJobCategory">Job Category</option>
            <option value="MaintenanceAnalysisCode">Analysis Code</option>
            <option value="MaintenanceReasonCode">Reason Code</option>
            <option value="ChecklistTemplate">Checklist Template</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No configuration changes recorded yet.
          </div>
        ) : (
          rows.map((row) => {
            const actorLabel = row.actor
              ? [row.actor.firstName, row.actor.lastName].filter(Boolean).join(" ") ||
                row.actor.email
              : "System";
            const open = expanded === row.id;
            return (
              <article
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {row.entityType} · {row.action}
                      <span className="ml-2 font-normal text-slate-500">v{row.version}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString()} · {actorLabel}
                    </p>
                    {row.reason ? (
                      <p className="mt-2 text-sm text-slate-700">{row.reason}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-sm text-brand-700 underline"
                    onClick={() => setExpanded(open ? null : row.id)}
                  >
                    {open ? "Hide detail" : "Show before/after"}
                  </button>
                </div>
                {open ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      {row.beforeJson ?? "null"}
                    </pre>
                    <pre className="overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                      {row.afterJson ?? "null"}
                    </pre>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
