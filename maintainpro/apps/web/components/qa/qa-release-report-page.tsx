"use client";

import { useQuery } from "@tanstack/react-query";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { InlineLoadingState } from "@/components/ui/page-state";
import { fetchReleaseQualityReport } from "@/lib/qa-api";

export function QaReleaseReportPage() {
  const query = useQuery({
    queryKey: ["qa", "release-report"],
    queryFn: () => fetchReleaseQualityReport({ uatPhase: "UAT-025" })
  });

  const data = query.data;

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />
      <header>
        <h2 className="text-2xl font-semibold">Release Quality Report</h2>
        <p className="text-sm text-slate-500">Readiness verdict based on open issues, security, and regression status.</p>
      </header>
      {query.isLoading ? (
        <InlineLoadingState label="Generating report…" />
      ) : (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Verdict</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{data?.verdict ?? "—"}</p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data?.summary ?? {}).map(([key, value]) => (
              <div key={key} className="rounded-lg border p-3">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{key}</dt>
                <dd className="mt-1 text-xl font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
