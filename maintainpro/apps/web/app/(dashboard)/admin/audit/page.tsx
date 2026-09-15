"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchAuditList, type AuditEntry } from "@/lib/audit-api";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const ACTION_STYLES: Record<string, string> = {
  CREATE: "text-emerald-700 bg-emerald-50 border-emerald-200",
  UPDATE: "text-blue-700 bg-blue-50 border-blue-200",
  DELETE: "text-red-700 bg-red-50 border-red-200"
};

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actorName = entry.actor
    ? [entry.actor.firstName, entry.actor.lastName].filter(Boolean).join(" ") || entry.actor.email || "Unknown"
    : "System";

  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
        {new Date(entry.createdAt).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_STYLES[entry.action] ?? "text-slate-700 bg-slate-50 border-slate-200"}`}
        >
          {entry.action}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-slate-800">{entry.entity}</td>
      <td className="px-4 py-3 text-xs text-slate-500 font-mono break-all max-w-[140px]">{entry.entityId}</td>
      <td className="px-4 py-3 text-sm text-slate-700">{actorName}</td>
      <td className="px-4 py-3 text-sm text-slate-600 max-w-[220px]">{entry.reason ?? "—"}</td>
    </tr>
  );
}

export default function AuditPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);

  const [entity, setEntity] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "audit", entity, page],
    queryFn: () => fetchAuditList({ entity: entity.trim() || undefined, page, pageSize: 50 }),
    enabled: isAdmin,
    staleTime: 30_000
  });

  const entries = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Audit Log</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Read-only audit trail. Filter by entity type or browse all platform actions.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Admin
        </Link>
      </header>

      <div className="flex items-center gap-3">
        <label htmlFor="entity-filter" className="text-sm font-medium text-slate-700 whitespace-nowrap">
          Entity type
        </label>
        <input
          id="entity-filter"
          type="text"
          placeholder="e.g. WorkOrder, Asset…"
          value={entity}
          onChange={(e) => { setEntity(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState
          title="Could not load audit log"
          description="The audit API may be unavailable. Check system health."
        />
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <EmptyState title="No audit entries" description="No audit records match the current filter." />
      )}

      {!isLoading && !isError && entries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Time</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Action</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Entity</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Entity ID</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Actor</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} entries)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
