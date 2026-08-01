"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { defaultReportFilters, getReportsDashboard } from "@/components/reports/api";
import { SummaryCards } from "@/components/reports/report-ui";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";

import { DashboardSection } from "./dashboard-section";

type ReportsSummaryProps = {
  readOnly?: boolean;
};

export function ReportsSummary({ readOnly = false }: ReportsSummaryProps) {
  const query = useQuery({
    queryKey: ["dashboard", "reports"],
    queryFn: () => getReportsDashboard(defaultReportFilters()),
    refetchInterval: 60_000
  });

  if (query.isLoading) {
    return (
      <DashboardSection
        title="Reports summary"
        description={
          readOnly
            ? "Read-only cross-module report metrics from existing report records."
            : "Cross-module report metrics from existing report records."
        }
      >
        <InlineLoadingState label="Loading report summary…" />
      </DashboardSection>
    );
  }

  if (query.isError) {
    return (
      <DashboardSection
        title="Reports summary"
        description={
          readOnly
            ? "Read-only cross-module report metrics from existing report records."
            : "Cross-module report metrics from existing report records."
        }
      >
        <ErrorState title="Could not load reports" error={query.error} onRetry={() => query.refetch()} />
      </DashboardSection>
    );
  }

  const dashboard = query.data;

  if (!dashboard || dashboard.summaryCards.length === 0) {
    return (
      <DashboardSection
        title="Reports summary"
        description="No report summary cards are available for the current range."
        action={
          <Link href={"/reports" as Route} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            Open reports <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Report summaries will appear here when data is available for your tenant.
        </p>
      </DashboardSection>
    );
  }

  const coverage = dashboard.dataCoverage;
  const degradedNotice =
    coverage && !Array.isArray(coverage) ? coverage.degradedNotice ?? null : null;
  const metaBits = [
    dashboard.currencyCode ? `Currency ${dashboard.currencyCode}` : null,
    dashboard.reportingTimezone ? `Timezone ${dashboard.reportingTimezone}` : null,
    dashboard.generatedAt ? `Generated ${new Date(dashboard.generatedAt).toLocaleString()}` : null
  ].filter(Boolean);

  return (
    <DashboardSection
      title="Reports summary"
      description={
        readOnly
          ? "Read-only cross-module report metrics from existing report records."
          : "Cross-module report metrics from existing report records."
      }
      action={
        <Link href={"/reports" as Route} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
          Open reports <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      {degradedNotice ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
          {degradedNotice}
        </p>
      ) : null}
      {metaBits.length ? (
        <p className="mb-3 text-xs font-medium text-slate-500">{metaBits.join(" · ")}</p>
      ) : null}
      <SummaryCards cards={dashboard.summaryCards} />
    </DashboardSection>
  );
}
