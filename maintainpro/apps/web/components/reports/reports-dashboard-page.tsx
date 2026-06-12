"use client";

import { Activity, AlertTriangle, ArrowRight, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/lib/api-client";
import { toSafeApiErrorMessage } from "@/components/ui/page-state";

import { defaultReportFilters, getReportsDashboard, REPORT_MODULES } from "./api";
import { ReportFiltersBar, ReportHeader, StatePanel, SummaryCards } from "./report-ui";
import { ReportFilters } from "./types";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const toneClass: Record<string, string> = {
  neutral: "border-slate-200 bg-white text-slate-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-sky-200 bg-sky-50 text-sky-800"
};

export function ReportsDashboardPage() {
  const [filters, setFilters] = useState<ReportFilters>(() => defaultReportFilters());
  const query = useQuery({
    queryKey: ["reports", "dashboard", filters],
    queryFn: () => getReportsDashboard(filters),
    refetchInterval: 60_000
  });

  const dashboard = query.data;

  return (
    <div className="space-y-5 print:bg-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <ReportHeader
          title="Reports"
          description="A decision dashboard for operations, financials, user activity, assets, inventory, performance KPIs, driver intelligence, fuel analytics, vehicle costs, and audit activity."
          generatedAt={dashboard?.generatedAt}
        />
        <button type="button" onClick={() => query.refetch()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 print:hidden">
          <RefreshCw size={15} className={query.isFetching ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <ReportFiltersBar filters={filters} options={dashboard?.filterOptions} onChange={setFilters} onReset={() => setFilters(defaultReportFilters())} compact />

      {query.isLoading ? (
        <StatePanel type="loading" title="Loading report dashboard" message="Preparing live report summaries and cross-module metrics." />
      ) : query.isError ? (
        <StatePanel type="error" title="Could not load reports" message={toSafeApiErrorMessage(query.error, "The reports dashboard API returned an error.")} onRetry={() => query.refetch()} />
      ) : dashboard ? (
        <>
          <SummaryCards cards={dashboard.summaryCards} />

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Monthly Expense Trend</p>
                  <p className="text-xs text-slate-500">Cross-module financial signals from real expense records</p>
                </div>
                <BarChart3 size={18} className="text-brand-600" />
              </div>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboard.crossModuleTrend} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#64748b" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cbd5e1" }} />
                    <Line type="monotone" dataKey="expense" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-slate-900">
                <AlertTriangle size={17} className="text-amber-500" />
                <p className="text-sm font-semibold">Action Alerts</p>
              </div>
              <div className="mt-3 space-y-2">
                {dashboard.alerts.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No immediate report alerts in the selected range.</p>
                ) : (
                  dashboard.alerts.slice(0, 7).map((alert, index) => (
                    <div key={`${alert.type}-${index}`} className={`rounded-lg border px-3 py-2 text-sm ${toneClass[alert.tone ?? "neutral"]}`}>
                      <p className="font-semibold">{alert.type}</p>
                      <p className="mt-0.5 text-slate-600">{alert.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {REPORT_MODULES.map((module) => {
              const summary = dashboard.moduleSummaries.find((item) => item.module === module.slug);
              return (
                <Link key={module.slug} href={`/reports/${module.slug}` as Route} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{module.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{module.description}</p>
                    </div>
                    <Activity size={18} className="text-brand-600" />
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold text-slate-950">{summary?.value ?? "Open"}</p>
                      <p className="mt-1 text-xs text-slate-500">{summary?.helper ?? "View detailed report"}</p>
                    </div>
                    <ArrowRight size={17} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </div>
                </Link>
              );
            })}
          </div>

          {dashboard.dataCoverage.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <p className="font-semibold text-amber-950">Data Coverage Notes</p>
              <div className="mt-2 space-y-1">
                {dashboard.dataCoverage.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <StatePanel type="empty" title="No report data" message="No dashboard metrics are available for the selected range." />
      )}
    </div>
  );
}