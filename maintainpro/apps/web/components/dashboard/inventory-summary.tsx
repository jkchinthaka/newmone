"use client";

import Link from "next/link";
import type { Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import {
  getInventoryParts,
  getLowStockParts,
  getPurchaseOrders
} from "@/components/inventory/api";
import { calculateSummary, formatCurrency } from "@/components/inventory/helpers";
import { ErrorState, InlineLoadingState } from "@/components/ui/page-state";
import { formatNumber } from "@/lib/localization";

import { DashboardCard } from "./dashboard-card";
import { DashboardSection } from "./dashboard-section";

export function InventorySummary() {
  const partsQuery = useQuery({
    queryKey: ["dashboard", "inventory", "parts"],
    queryFn: getInventoryParts,
    refetchInterval: 60_000
  });

  const lowStockQuery = useQuery({
    queryKey: ["dashboard", "inventory", "low-stock"],
    queryFn: getLowStockParts,
    refetchInterval: 60_000
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: ["dashboard", "inventory", "purchase-orders"],
    queryFn: getPurchaseOrders,
    refetchInterval: 60_000
  });

  const isLoading = partsQuery.isLoading || lowStockQuery.isLoading || purchaseOrdersQuery.isLoading;
  const isError = partsQuery.isError || lowStockQuery.isError || purchaseOrdersQuery.isError;
  const error = partsQuery.error ?? lowStockQuery.error ?? purchaseOrdersQuery.error;

  const refetchAll = () => {
    void partsQuery.refetch();
    void lowStockQuery.refetch();
    void purchaseOrdersQuery.refetch();
  };

  if (isLoading) {
    return (
      <DashboardSection
        title="Inventory overview"
        description="Stock levels and procurement activity from live inventory records."
      >
        <InlineLoadingState label="Loading inventory summary…" />
      </DashboardSection>
    );
  }

  if (isError) {
    return (
      <DashboardSection
        title="Inventory overview"
        description="Stock levels and procurement activity from live inventory records."
      >
        <ErrorState
          title="Could not load inventory"
          error={error}
          onRetry={refetchAll}
        />
      </DashboardSection>
    );
  }

  const summary = calculateSummary(partsQuery.data ?? [], purchaseOrdersQuery.data ?? []);

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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <DashboardCard label="Total items" value={formatNumber(summary.totalItems, { fallback: "0" })} />
        <DashboardCard label="Stock value" value={formatCurrency(summary.totalValue)} tone="info" />
        <DashboardCard label="Low stock" value={formatNumber(summary.lowStockCount, { fallback: "0" })} tone="warning" />
        <DashboardCard label="Critical stock" value={formatNumber(summary.criticalCount, { fallback: "0" })} tone="danger" />
        <DashboardCard label="Out of stock" value={formatNumber(summary.outOfStockCount, { fallback: "0" })} tone="danger" />
        <DashboardCard label="Pending POs" value={formatNumber(summary.pendingPurchaseOrders, { fallback: "0" })} tone="neutral" />
      </div>
      {(lowStockQuery.data?.length ?? 0) > 0 ? (
        <p className="mt-4 text-sm text-slate-600">
          {formatNumber(lowStockQuery.data?.length ?? 0, { fallback: "0" })} parts are currently flagged as low stock.
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No low-stock alerts returned right now.</p>
      )}
    </DashboardSection>
  );
}
