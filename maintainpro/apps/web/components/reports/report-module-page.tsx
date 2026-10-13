"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getApiErrorMessage } from "@/lib/api-client";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

import { defaultReportFilters, getReportModule, isReportModuleSlug } from "./api";
import { ExportActions, ReportFiltersBar, ReportHeader, ReportTableView, StatePanel } from "./report-ui";
import { ReportFilters, ReportModuleSlug } from "./types";
import { isRetainedReportSlug, RETAINED_REPORTS } from "@/lib/report-workspace";

export function ReportModulePage({ module }: { module: string }) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(() => {
    const initial = defaultReportFilters();
    const search = searchParams.get("search");
    if (search) initial.search = search;
    return initial;
  });
  const [isExporting, setIsExporting] = useState(false);
  const moduleSlug = isRetainedReportSlug(module) ? module : null;
  const definition = RETAINED_REPORTS.find((item) => item.slug === moduleSlug) ?? RETAINED_REPORTS[0];

  const query = useQuery({
    queryKey: ["reports", moduleSlug, filters],
    queryFn: () => getReportModule(moduleSlug as ReportModuleSlug, filters),
    enabled: moduleSlug != null,
    refetchInterval: 60_000
  });

  const report = query.data;
  const tabs = useMemo(() => RETAINED_REPORTS, []);

  function updateFilters(next: ReportFilters) {
    setFilters(next);
  }

  function resetFilters() {
    setFilters(defaultReportFilters());
  }

  if (!moduleSlug || !isReportModuleSlug(module)) {
    return (
      <StatePanel
        type="empty"
        title="Report module not found"
        message="Choose one of the available report modules from the Reports dashboard."
      />
    );
  }

  return (
    <div className="space-y-5 print:bg-white">
      <PageBreadcrumbs />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <ReportHeader title={report?.title ?? definition.label} description={report?.description ?? definition.description} generatedAt={report?.generatedAt} backHref="/reports" />
        <ExportActions module={moduleSlug} filters={filters} isExporting={isExporting} setIsExporting={setIsExporting} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        {tabs.map((item) => (
          <Link
            key={item.slug}
            href={`/reports?module=${item.slug}` as Route}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${item.slug === moduleSlug ? "bg-brand-600 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <ReportFiltersBar filters={filters} options={report?.filterOptions} onChange={updateFilters} onReset={resetFilters} />

      {query.isLoading ? (
        <StatePanel type="loading" title="Loading report" message="Loading verified records for this report." />
      ) : query.isError ? (
        <StatePanel
          type="error"
          title="Could not load report"
          message={getApiErrorMessage(query.error, "The report API returned an error.")}
          onRetry={() => {
            query.refetch().catch((error) => toast.error(getApiErrorMessage(error, "Retry failed.")));
          }}
        />
      ) : report ? (
        <>
          <ReportTableView table={report.table} filters={filters} onChange={updateFilters} />
        </>
      ) : (
        <StatePanel type="empty" title="No report data" message="No data is available for the selected filters." />
      )}
    </div>
  );
}