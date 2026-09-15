"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/page-state";
import { fetchDataQualityIssues, type DataQualityIssue } from "@/lib/admin-governance-api";
import { isAdminConsoleRole } from "@/lib/admin-console";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const SEVERITY_STYLES: Record<DataQualityIssue["severity"], string> = {
  CRITICAL: "border-red-200 bg-red-50 text-red-800",
  HIGH: "border-orange-200 bg-orange-50 text-orange-800",
  WARNING: "border-yellow-200 bg-yellow-50 text-yellow-800",
  INFO: "border-blue-200 bg-blue-50 text-blue-800"
};

const SEVERITY_ORDER: DataQualityIssue["severity"][] = ["CRITICAL", "HIGH", "WARNING", "INFO"];

function IssueCard({ issue }: { issue: DataQualityIssue }) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs text-slate-400">{issue.code}</span>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{issue.message}</h3>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_STYLES[issue.severity]}`}
        >
          {issue.severity}
        </span>
      </div>
      <dl className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-400">Domain</dt>
          <dd className="mt-0.5 capitalize">{issue.domain}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-slate-400">Entity</dt>
          <dd className="mt-0.5">{issue.entityType}</dd>
        </div>
        {issue.count !== undefined && (
          <div>
            <dt className="font-semibold uppercase tracking-wide text-slate-400">Count</dt>
            <dd className="mt-0.5 font-semibold text-slate-800">{issue.count}</dd>
          </div>
        )}
      </dl>
      {issue.suggestedAction && (
        <p className="mt-3 text-xs text-slate-500">
          <span className="font-semibold">Suggested action:</span> {issue.suggestedAction}
        </p>
      )}
    </article>
  );
}

export default function DataQualityPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const isAdmin = isAdminConsoleRole(roleName);

  const { data: issues, isLoading, isError } = useQuery({
    queryKey: ["admin-governance", "data-quality"],
    queryFn: fetchDataQualityIssues,
    enabled: isAdmin,
    staleTime: 60_000
  });

  const grouped = SEVERITY_ORDER.reduce<Record<string, DataQualityIssue[]>>((acc, sev) => {
    acc[sev] = (issues ?? []).filter((i) => i.severity === sev);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Data Quality</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Platform-wide data quality findings grouped by severity. Issues are read-only — correct the underlying
            records in their respective modules.
          </p>
        </div>
        <Link
          href="/admin"
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Admin
        </Link>
      </header>

      {isLoading && <LoadingState />}
      {isError && (
        <ErrorState
          title="Could not load data quality report"
          description="The admin governance API may be unavailable. Try again or check system health."
        />
      )}

      {!isLoading && !isError && (issues ?? []).length === 0 && (
        <EmptyState title="No data quality issues" description="All checks passed — no open findings detected." />
      )}

      {!isLoading && !isError &&
        SEVERITY_ORDER.map((sev) =>
          grouped[sev].length > 0 ? (
            <section key={sev} aria-labelledby={`dq-section-${sev}`}>
              <h3
                id={`dq-section-${sev}`}
                className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {sev} ({grouped[sev].length})
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {grouped[sev].map((issue) => (
                  <IssueCard key={issue.code} issue={issue} />
                ))}
              </div>
            </section>
          ) : null
        )}
    </div>
  );
}
