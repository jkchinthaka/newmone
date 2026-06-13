"use client";

import Link from "next/link";
import type { Route } from "next";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Building2, RefreshCw } from "lucide-react";

import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { FacilityAttentionList } from "@/components/facilities/facility-attention-list";
import { FacilityBreakdownTable } from "@/components/facilities/facility-breakdown-table";
import { FacilityKpiCard } from "@/components/facilities/facility-kpi-card";
import { ErrorState, InlineLoadingState, PermissionState } from "@/components/ui/page-state";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  canViewFacilityReports,
  formatFacilityDashboardCount,
  hasFacilityDashboardData,
  type PublicFacilityDashboardSummary
} from "@/lib/facility-dashboard";
import { getFacilityDashboardSummary } from "@/lib/facilities-api";
import { formatDateTime } from "@/lib/localization";
import { extractRoleName } from "@/lib/role-redirect";
import { getStoredPermissions } from "@/lib/user-role";
import { useCurrentUser } from "@/lib/use-current-user";

export function FacilityDashboardPage() {
  const user = useCurrentUser();
  const roleName = extractRoleName(user);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [summary, setSummary] = useState<PublicFacilityDashboardSummary | null>(null);
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
      setSummary(await getFacilityDashboardSummary());
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
        <PermissionState description="Your role does not include facility reporting access." />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <InlineLoadingState label="Loading facility reports…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Could not load facility reports"
          error={error}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <PageBreadcrumbs />
        <ErrorState
          title="Facility reports unavailable"
          description={getApiErrorMessage(error, "No summary data was returned.")}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const hasData = hasFacilityDashboardData(summary);

  return (
    <div className="space-y-5">
      <PageBreadcrumbs />

      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-700" aria-hidden="true" />
            <h1 className="text-2xl font-semibold text-slate-900">Facility Reports</h1>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Tenant-scoped hierarchy counts and facility issue KPIs from live data only. Generated{" "}
            {formatDateTime(summary.generatedAt)}.
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
            href={"/facilities" as Route}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Building2 size={16} aria-hidden="true" />
            Hierarchy
          </Link>
          <Link
            href={"/facilities/reports/aging" as Route}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            SLA / aging
          </Link>
          <Link
            href={"/cleaning/issues" as Route}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Issue list
          </Link>
        </div>
      </header>

      {!hasData ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          No facility hierarchy or issues recorded for this tenant yet. Counts will appear here as real
          data is created — no placeholder metrics are shown.
        </div>
      ) : null}

      <section aria-labelledby="facility-kpi-heading" className="space-y-3">
        <h2 id="facility-kpi-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Key metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FacilityKpiCard label="Properties" value={formatFacilityDashboardCount(summary.hierarchy.propertyCount)} />
          <FacilityKpiCard label="Buildings" value={formatFacilityDashboardCount(summary.hierarchy.buildingCount)} />
          <FacilityKpiCard label="Floors" value={formatFacilityDashboardCount(summary.hierarchy.floorCount)} />
          <FacilityKpiCard
            label="Rooms"
            value={formatFacilityDashboardCount(summary.hierarchy.roomCount)}
            hint={
              summary.hierarchy.inactiveRoomCount > 0
                ? `${formatFacilityDashboardCount(summary.hierarchy.inactiveRoomCount)} inactive`
                : undefined
            }
          />
          <FacilityKpiCard
            label="Open issues"
            value={formatFacilityDashboardCount(summary.issues.openIssueCount + summary.issues.inProgressIssueCount)}
            tone={summary.issues.openIssueCount + summary.issues.inProgressIssueCount > 0 ? "warning" : "success"}
          />
          <FacilityKpiCard
            label="Overdue issues"
            value={formatFacilityDashboardCount(summary.issues.overdueIssueCount)}
            hint="Based on SLA target dates for open/in-progress issues"
            tone={summary.issues.overdueIssueCount > 0 ? "danger" : "neutral"}
          />
          <FacilityKpiCard
            label="Critical issues"
            value={formatFacilityDashboardCount(summary.issues.criticalOpenIssueCount)}
            tone={summary.issues.criticalOpenIssueCount > 0 ? "danger" : "neutral"}
          />
          <FacilityKpiCard
            label="Linked work orders"
            value={formatFacilityDashboardCount(summary.workOrderBridge.linkedWorkOrderCount)}
            hint={`${formatFacilityDashboardCount(summary.workOrderBridge.unlinkedOpenIssueCount)} open without WO`}
            tone="info"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <FacilityBreakdownTable
          title="Issues by category"
          description="From recorded facility issue categories"
          rows={summary.breakdowns.byCategory}
        />
        <FacilityBreakdownTable
          title="Issues by severity"
          rows={summary.breakdowns.bySeverity}
        />
        <FacilityBreakdownTable
          title="Issues by status"
          rows={summary.breakdowns.byStatus}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Top rooms by open issues</h2>
          <p className="text-xs text-slate-500">Open and in-progress issues with a linked room</p>
          {summary.attention.topRoomsByOpenIssues.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No room-linked open issues yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {summary.attention.topRoomsByOpenIssues.map((row) => (
                <li
                  key={row.roomId}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-slate-900">{row.roomName}</span>
                  <span className="tabular-nums text-slate-700">{row.openIssueCount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Issue linkage</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Room-linked issues</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {formatFacilityDashboardCount(summary.issues.roomLinkedIssueCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Unlinked issues</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {formatFacilityDashboardCount(summary.issues.unlinkedIssueCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Total issues</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {formatFacilityDashboardCount(summary.issues.totalIssueCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Resolved / closed</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {formatFacilityDashboardCount(
                  summary.issues.resolvedIssueCount + summary.issues.closedIssueCount
                )}
              </dd>
            </div>
          </dl>
        </section>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <FacilityAttentionList
          title="Overdue issues"
          description="Open/in-progress issues past SLA target"
          items={summary.attention.overdueIssuesPreview}
          emptyLabel="No overdue issues based on SLA targets."
        />
        <FacilityAttentionList
          title="Critical issues"
          items={summary.attention.criticalIssuesPreview}
          emptyLabel="No open critical issues."
        />
        <FacilityAttentionList
          title="Unlinked open issues"
          description="Open/in-progress issues without a work order"
          items={summary.attention.unlinkedOpenIssuesPreview}
          emptyLabel="All open issues are linked or none are open."
        />
      </section>
    </div>
  );
}
