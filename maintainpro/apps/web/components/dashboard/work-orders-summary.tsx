"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { formatDate, humanWorkOrderStatusLabel } from "@/components/work-orders/helpers";
import type { WorkOrder } from "@/components/work-orders/types";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { RefreshErrorBanner } from "@/components/ui/refresh-error-banner";
import type { WorkOrderDashboardStats } from "@/lib/dashboard-roles";
import { workOrderCountsFromListSummary, workOrderCountsFromQueueSummary } from "@/lib/dashboard-work-order-counts";
import { backgroundPollingOptions, listErrorPresentation } from "@/lib/list-query-state";
import { formatNumber } from "@/lib/localization";
import { withTenantScope } from "@/lib/tenant-query";
import {
  DEFAULT_QUEUE_FILTERS,
  fetchWorkOrderQueue,
  fetchWorkOrderQueueSummary,
  type WorkOrderQueueFilters
} from "@/lib/work-order-queues-api";

import { DashboardCard } from "./dashboard-card";
import { DashboardSection } from "./dashboard-section";

type WorkOrdersSummaryProps = {
  assignedUserId?: string | null;
  title?: string;
  description?: string;
  showPriorityList?: boolean;
};

const DASHBOARD_POLL_MS = 60_000;
const PRIORITY_LIMIT = 5;

function priorityListFilters(assignedUserId: string | null): WorkOrderQueueFilters {
  return {
    ...DEFAULT_QUEUE_FILTERS,
    // Technicians cannot open "all"; "my-tasks" plus technicianId scopes rows and the list summary to them.
    queue: assignedUserId ? "my-tasks" : "open-load",
    technicianId: assignedUserId ?? undefined,
    page: 1,
    pageSize: PRIORITY_LIMIT
  };
}

function completedCountFilters(assignedUserId: string): WorkOrderQueueFilters {
  return { ...DEFAULT_QUEUE_FILTERS, queue: "completed", technicianId: assignedUserId, page: 1, pageSize: 1 };
}

export function WorkOrdersSummary({
  assignedUserId = null,
  title = "Jobs",
  description = "Live job counts from the maintenance queue.",
  showPriorityList = true
}: WorkOrdersSummaryProps) {
  const assigned = assignedUserId != null;
  const listFilters = priorityListFilters(assignedUserId);

  // Company counts: server queue summary. Same cache entry as the nav badges and the Work Orders page.
  const summaryQuery = useQuery({
    queryKey: withTenantScope(["work-orders", "queue-summary", ""]),
    queryFn: () => fetchWorkOrderQueueSummary(),
    enabled: !assigned,
    staleTime: 30_000,
    ...backgroundPollingOptions(DASHBOARD_POLL_MS)
  });

  // Priority rows (and, for an assignee, their server-side counts).
  const listQuery = useQuery({
    queryKey: withTenantScope(["dashboard", "work-orders", "priority", assignedUserId ?? "all"]),
    queryFn: () => fetchWorkOrderQueue(listFilters),
    enabled: assigned || showPriorityList,
    staleTime: 30_000,
    ...backgroundPollingOptions(DASHBOARD_POLL_MS)
  });

  const completedQuery = useQuery({
    queryKey: withTenantScope(["dashboard", "work-orders", "completed-count", assignedUserId ?? ""]),
    queryFn: () => fetchWorkOrderQueue(completedCountFilters(assignedUserId as string)),
    enabled: assigned,
    staleTime: 60_000,
    select: (data) => data.total,
    ...backgroundPollingOptions(DASHBOARD_POLL_MS)
  });

  const countsQuery = assigned ? listQuery : summaryQuery;
  const hasCounts = Boolean(countsQuery.data);
  const errorMode = listErrorPresentation({ isError: countsQuery.isError, hasData: hasCounts });

  if (countsQuery.isLoading) {
    return (
      <DashboardSection title={title} description={description}>
        <InlineLoadingState label="Loading job summary…" />
      </DashboardSection>
    );
  }

  if (errorMode === "full") {
    return (
      <DashboardSection title={title} description={description}>
        <ErrorState title="Could not load jobs" error={countsQuery.error} onRetry={() => void countsQuery.refetch()} />
      </DashboardSection>
    );
  }

  const stats: WorkOrderDashboardStats = assigned
    ? workOrderCountsFromListSummary(listQuery.data, completedQuery.data)
    : workOrderCountsFromQueueSummary(summaryQuery.data!);
  const priorityOrders = showPriorityList ? (listQuery.data?.data ?? []) : [];
  const listFailed = showPriorityList && listQuery.isError && !listQuery.data;

  return (
    <DashboardSection
      title={title}
      description={description}
      action={
        <Link
          href={(assigned ? "/work-orders/my" : "/work-orders") as Route}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Open jobs <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      {errorMode === "banner" ? (
        <RefreshErrorBanner className="mb-3" onRetry={() => void countsQuery.refetch()} retrying={countsQuery.isFetching} />
      ) : null}
      <WorkOrderStatsGrid stats={stats} assigned={assigned} />
      <p className="mt-2 text-xs text-slate-500">
        Counts come from the server for all matching jobs (refreshed every 60s while this tab is open).
      </p>
      {showPriorityList ? (
        listFailed ? (
          <RefreshErrorBanner className="mt-4" message="Could not load priority jobs." onRetry={() => void listQuery.refetch()} retrying={listQuery.isFetching} />
        ) : listQuery.isLoading ? (
          <div className="mt-4">
            <InlineLoadingState label="Loading priority jobs…" />
          </div>
        ) : (
          <PriorityWorkOrdersList orders={priorityOrders} emptyLabel={assigned ? "No assigned jobs right now." : "No open jobs need attention."} />
        )
      ) : null}
    </DashboardSection>
  );
}

function WorkOrderStatsGrid({ stats, assigned }: { stats: WorkOrderDashboardStats; assigned: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <DashboardCard label={assigned ? "Assigned" : "Total"} value={formatNumber(stats.total, { fallback: "0" })} />
      <DashboardCard label="Open" value={formatNumber(stats.open, { fallback: "0" })} tone="info" />
      <DashboardCard label="In progress" value={formatNumber(stats.inProgress, { fallback: "0" })} tone="warning" />
      <DashboardCard label="Overdue" value={formatNumber(stats.overdue, { fallback: "0" })} tone="danger" />
      <DashboardCard label="Completed" value={formatNumber(stats.completed, { fallback: "0" })} tone="success" />
    </div>
  );
}

function PriorityWorkOrdersList({
  orders,
  emptyLabel
}: {
  orders: WorkOrder[];
  emptyLabel: string;
}) {
  if (orders.length === 0) {
    return <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-4 space-y-2" aria-label="Priority jobs">
      {orders.map((order) => (
        <li key={order.id} className="rounded-lg border border-slate-200 px-3 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{order.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {order.woNumber}
                {order.dueDate ? ` · Due ${formatDate(order.dueDate)}` : ""}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold uppercase text-slate-700">
              {humanWorkOrderStatusLabel(order.status)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
