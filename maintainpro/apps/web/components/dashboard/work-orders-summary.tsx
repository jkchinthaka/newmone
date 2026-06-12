"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { fetchWorkOrders } from "@/components/work-orders/api";
import { formatDate } from "@/components/work-orders/helpers";
import type { WorkOrder } from "@/components/work-orders/types";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import {
  computeWorkOrderDashboardStats,
  selectPriorityWorkOrders,
  type WorkOrderDashboardStats
} from "@/lib/dashboard-roles";
import { formatNumber } from "@/lib/localization";

import { DashboardCard } from "./dashboard-card";
import { DashboardSection } from "./dashboard-section";

type WorkOrdersSummaryProps = {
  assignedUserId?: string | null;
  title?: string;
  description?: string;
  showPriorityList?: boolean;
};

export function WorkOrdersSummary({
  assignedUserId = null,
  title = "Work orders",
  description = "Live work order counts from the maintenance queue.",
  showPriorityList = true
}: WorkOrdersSummaryProps) {
  const query = useQuery({
    queryKey: ["dashboard", "work-orders"],
    queryFn: fetchWorkOrders,
    refetchInterval: 60_000
  });

  if (query.isLoading) {
    return (
      <DashboardSection title={title} description={description}>
        <InlineLoadingState label="Loading work order summary…" />
      </DashboardSection>
    );
  }

  if (query.isError) {
    return (
      <DashboardSection title={title} description={description}>
        <ErrorState title="Could not load work orders" error={query.error} onRetry={() => query.refetch()} />
      </DashboardSection>
    );
  }

  const orders = query.data ?? [];
  const stats = computeWorkOrderDashboardStats(orders, { assignedUserId });
  const scopedOrders =
    assignedUserId != null ? orders.filter((order) => order.technicianId === assignedUserId) : orders;
  const priorityOrders = showPriorityList ? selectPriorityWorkOrders(scopedOrders, 5) : [];

  return (
    <DashboardSection
      title={title}
      description={description}
      action={
        <Link
          href={(assignedUserId ? "/work-orders" : "/work-orders") as Route}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Open work orders <ArrowRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <WorkOrderStatsGrid stats={stats} assigned={assignedUserId != null} />
      {showPriorityList ? (
        <PriorityWorkOrdersList orders={priorityOrders} emptyLabel={assignedUserId ? "No assigned work orders right now." : "No open work orders need attention."} />
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
    <ul className="mt-4 space-y-2" aria-label="Priority work orders">
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
              {order.status.replace(/_/g, " ")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
