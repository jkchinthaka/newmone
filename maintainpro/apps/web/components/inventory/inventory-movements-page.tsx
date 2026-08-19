"use client";

import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

import { getInventoryDashboard, getInventoryMovements } from "./api";
import { formatDateTime } from "./helpers";
import { InventorySectionNav } from "./inventory-section-nav";
import { InventoryDashboardKpis, StockMovement } from "./types";

export default function InventoryMovementsPage() {
  const dashboardQuery = useQuery({
    queryKey: ["inventory", "dashboard"],
    queryFn: getInventoryDashboard
  });
  const movementsQuery = useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: () => getInventoryMovements({ take: 200 })
  });

  const kpis = dashboardQuery.data as InventoryDashboardKpis | null;
  const movements = (movementsQuery.data ?? []) as Array<
    StockMovement & {
      part?: { partNumber: string; name: string };
      warehouse?: { code: string; name: string };
      sourceType?: string;
      sourceDocument?: string;
    }
  >;

  if (movementsQuery.isLoading && !movementsQuery.data) {
    return <LoadingState title="Loading movements" description="Fetching the stock movement ledger." />;
  }

  if (movementsQuery.isError) {
    return (
      <ErrorState
        error={movementsQuery.error}
        onRetry={() => void movementsQuery.refetch()}
        title="Unable to load movements"
        description={toSafeApiErrorMessage(movementsQuery.error, "Unable to load stock movements.")}
      />
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <PageBreadcrumbs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Stock Movements</h1>
        <p className="mt-1 text-sm text-slate-600">Immutable ledger of receipts, issues, returns, transfers, adjustments, and reversals.</p>
      </div>
      <InventorySectionNav />
      {kpis ? (
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi label="Today IN" value={kpis.todayIn} />
          <Kpi label="Today OUT" value={kpis.todayOut} />
          <Kpi label="Today Returns" value={kpis.todayReturns} />
          <Kpi label="Today Adjustments" value={kpis.todayAdjustments} />
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                  No stock movements yet.
                </td>
              </tr>
            ) : (
              movements.map((movement) => (
                <tr key={movement.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{formatDateTime(movement.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{movement.type}</td>
                  <td className="px-4 py-3">
                    {movement.part ? `${movement.part.partNumber} · ${movement.part.name}` : movement.partId}
                  </td>
                  <td className="px-4 py-3">{movement.warehouse?.code ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">{movement.quantity}</td>
                  <td className="px-4 py-3 text-slate-600">{movement.sourceDocument ?? movement.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{movement.notes ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
