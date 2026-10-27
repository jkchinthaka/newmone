"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { getInventoryDashboard, getPurchaseOrders } from "@/components/inventory/api";
import { formatCurrency } from "@/components/inventory/helpers";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { RefreshErrorBanner } from "@/components/ui/refresh-error-banner";
import { backgroundPollingOptions } from "@/lib/list-query-state";
import { formatNumber } from "@/lib/localization";

import { DashboardCard } from "./dashboard-card";
import { DashboardSection } from "./dashboard-section";

const PENDING_PO_STATUSES = new Set(["PENDING", "ORDERED", "PARTIALLY_RECEIVED"]);
const TITLE = "Inventory overview";
const DESCRIPTION = "Stock levels and procurement activity from live inventory records.";

export function InventorySummary() {
  // Server-side totals over every active part. Previously this downloaded the part list (bounded
  // to one page) plus the low-stock list every minute and counted rows in the browser.
  const kpisQuery = useQuery({
    queryKey: ["dashboard", "inventory", "kpis"],
    queryFn: getInventoryDashboard,
    staleTime: 30_000,
    ...backgroundPollingOptions(60_000)
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["dashboard", "inventory", "purchase-orders"],
    queryFn: getPurchaseOrders,
    staleTime: 60_000,
    select: (orders) => orders.filter((order) => PENDING_PO_STATUSES.has(String(order.status))).length,
    ...backgroundPollingOptions(5 * 60_000)
  });

  if (kpisQuery.isLoading) {
    return (
      <DashboardSection title={TITLE} description={DESCRIPTION}>
        <InlineLoadingState label="Loading inventory summary…" />
      </DashboardSection>
    );
  }

  if (kpisQuery.isError && !kpisQuery.data) {
    return (
      <DashboardSection title={TITLE} description={DESCRIPTION}>
        <ErrorState title="Could not load inventory" error={kpisQuery.error} onRetry={() => void kpisQuery.refetch()} />
      </DashboardSection>
    );
  }

  const kpis = kpisQuery.data;
  const summary = {
    totalItems: kpis?.totalItems ?? 0,
    onHand: kpis?.onHand ?? 0,
    available: kpis?.available ?? 0,
    totalValue: kpis?.inventoryValue ?? null,
    lowStockCount: kpis?.lowStock ?? 0,
    outOfStockCount: kpis?.outOfStock ?? 0
  };

  return (
    <DashboardSection
      title="Inventory overview"
      description="Stock levels and procurement activity from live inventory records."
      action={
        <div className="flex flex-wrap gap-3">
          <Link href={"/inventory" as Route} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            Inventory <ArrowRight size={14} aria-hidden="true" />
          </Link>
          <Link href={"/procurement" as Route} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800">
            Procurement <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      }
    >
      {kpisQuery.isError ? (
        <RefreshErrorBanner className="mb-3" onRetry={() => void kpisQuery.refetch()} retrying={kpisQuery.isFetching} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <DashboardCard label="Total items" value={formatNumber(summary.totalItems, { fallback: "0" })} />
        <DashboardCard label="On hand" value={formatNumber(summary.onHand, { fallback: "0" })} />
        <DashboardCard label="Available" value={formatNumber(summary.available, { fallback: "0" })} />
        <DashboardCard label="Stock value" value={summary.totalValue == null ? "—" : formatCurrency(summary.totalValue)} tone="info" />
        <DashboardCard label="Low stock" value={formatNumber(summary.lowStockCount, { fallback: "0" })} tone="warning" />
        <DashboardCard label="Out of stock" value={formatNumber(summary.outOfStockCount, { fallback: "0" })} tone="danger" />
        <DashboardCard
          label="Pending POs"
          value={purchaseOrdersQuery.data == null ? "—" : formatNumber(purchaseOrdersQuery.data, { fallback: "0" })}
          tone="neutral"
        />
      </div>
      {summary.lowStockCount > 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          {formatNumber(summary.lowStockCount, { fallback: "0" })} parts are currently flagged as low stock.
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No low-stock alerts returned right now.</p>
      )}
    </DashboardSection>
  );
}
