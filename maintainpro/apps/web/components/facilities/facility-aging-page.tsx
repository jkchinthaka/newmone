"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Building2, RefreshCw } from "lucide-react";

import { FacilityAgingHeatmap } from "@/components/facilities/facility-aging-heatmap";
import { FacilityAttentionList } from "@/components/facilities/facility-attention-list";
import { FacilityKpiCard } from "@/components/facilities/facility-kpi-card";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  formatAgingMetric,
  hasFacilityAgingData,
  type PublicFacilityAgingReport
} from "@/lib/facility-aging";
import { canViewFacilityReports } from "@/lib/facility-dashboard";
import { getFacilityAgingReport } from "@/lib/facilities-api";
import { formatDateTime } from "@/lib/localization";
import { extractRoleName } from "@/lib/role-redirect";
import { getStoredPermissions } from "@/lib/user-role";
import { useCurrentUser } from "@/lib/use-current-user";

export function FacilityAgingPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [report, setReport] = useState<PublicFacilityAgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setPermissions(getStoredPermissions());
  }, []);

  const canView = canViewFacilityReports(roleName, permissions.length ? permissions : getStoredPermissions());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setReport(await getFacilityAgingReport());
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canView) {
      void load();
    }
  }, [canView, load]);

  if (!canView) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <PermissionState description="Your role does not include facility aging report access." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <InlineLoadingState label="Loading SLA / aging report…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Could not load aging report"
          error={error}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Aging report unavailable"
          description={getApiErrorMessage(error, "No aging data was returned.")}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const hasData = hasFacilityAgingData(report);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-700" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-slate-900">SLA / Aging Report</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Tenant-scoped aging buckets for active facility issues and linked work orders with due dates.
            Generated {formatDateTime(report.generatedAt)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </button>
          <Link
            href={"/facilities/reports" as Route}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Summary reports
          </Link>
          <Link
            href={"/facilities" as Route}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Building2 size={16} aria-hidden="true" />
            Hierarchy
          </Link>
        </div>
      </header>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          No active facility issues or linked work orders with due dates for this tenant yet. Aging buckets
          will populate from real records only.
        </div>
      ) : null}

      <section aria-labelledby="aging-kpi-heading" className="space-y-3">
        <h2 id="aging-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Aging summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FacilityKpiCard
            label="Active issues"
            value={formatAgingMetric(report.issues.activeIssueCount)}
            tone={report.issues.activeIssueCount > 0 ? "warning" : "neutral"}
          />
          <FacilityKpiCard
            label="Overdue issues"
            value={formatAgingMetric(report.issues.overdueIssueCount)}
            hint="OPEN / IN_PROGRESS with SLA target in the past"
            tone={report.issues.overdueIssueCount > 0 ? "danger" : "neutral"}
          />
          <FacilityKpiCard
            label="Critical / high active"
            value={formatAgingMetric(report.issues.criticalHighActiveCount)}
            tone={report.issues.criticalHighActiveCount > 0 ? "danger" : "neutral"}
          />
          <FacilityKpiCard
            label="WO with due dates"
            value={formatAgingMetric(report.workOrders.withDueDateCount)}
            hint={`${formatAgingMetric(report.workOrders.overdueCount)} overdue`}
            tone={report.workOrders.overdueCount > 0 ? "danger" : "info"}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <FacilityAgingHeatmap
          title="Facility issue aging"
          description="Age since issue creation for open and in-progress issues"
          rows={report.issues.ageBuckets}
        />
        <FacilityAgingHeatmap
          title="Linked work order aging"
          description={
            report.workOrders.trackingAvailable
              ? "Age since work order creation for linked active work orders with due dates"
              : "No linked work orders with due dates are available for this tenant"
          }
          rows={report.workOrders.ageBuckets}
          emptyLabel="No linked work orders with due dates"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <FacilityAttentionList
          title="Overdue issues"
          description="Oldest SLA breaches first"
          items={report.issues.overduePreview}
          emptyLabel="No overdue issues"
        />
        <FacilityAttentionList
          title="Critical / high aging"
          description="Longest-open critical and high severity issues"
          items={report.issues.criticalHighAgingPreview}
          emptyLabel="No critical or high severity active issues"
        />
      </section>

      {report.workOrders.overduePreview.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <header className="mb-3">
            <h2 className="text-sm font-semibold text-slate-900">Overdue linked work orders</h2>
            <p className="text-xs text-slate-500">Work orders past due date that remain active</p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Work order</th>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 text-right">Age (days)</th>
                </tr>
              </thead>
              <tbody>
                {report.workOrders.overduePreview.map((workOrder) => (
                  <tr key={workOrder.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-900">{workOrder.woNumber}</td>
                    <td className="py-2 pr-4 text-slate-800">{workOrder.title}</td>
                    <td className="py-2 pr-4 text-slate-700">{formatDateTime(workOrder.dueDate)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-800">
                      {formatAgingMetric(workOrder.ageDays)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
