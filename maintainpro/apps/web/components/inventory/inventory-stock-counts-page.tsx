"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { apiClient } from "@/lib/api-client";

import { createStockCount, listStockCounts, transitionStockCount } from "./api";
import { InventorySectionNav } from "./inventory-section-nav";

type StockCountRow = {
  id: string;
  status: string;
  countType: string;
  blindCount: boolean;
  createdAt: string;
  warehouse?: { code?: string; name?: string };
  _count?: { lines: number };
};

export default function InventoryStockCountsPage() {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/warehouses");
      const data = response.data?.data ?? response.data ?? [];
      return Array.isArray(data) ? data : [];
    }
  });

  const sessionsQuery = useQuery({
    queryKey: ["inventory", "stock-counts"],
    queryFn: () => listStockCounts()
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!warehouseId) throw new Error("Select a warehouse first");
      return createStockCount({ warehouseId, countType: "CYCLE" });
    },
    onSuccess: async () => {
      setMessage("Stock count session created as Draft. Open it, count lines, then review and approve before posting.");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
    },
    onError: (error) => setMessage(toSafeApiErrorMessage(error, "Could not create stock count"))
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => transitionStockCount(id, status),
    onSuccess: async () => {
      setMessage("Stock count status updated.");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
    },
    onError: (error) => setMessage(toSafeApiErrorMessage(error, "Could not update stock count status"))
  });

  const rows = (sessionsQuery.data as StockCountRow[] | null) ?? [];
  const warehouses = (warehousesQuery.data as Array<{ id: string; code?: string; name?: string }>) ?? [];

  if (sessionsQuery.isLoading && !sessionsQuery.data) {
    return (
      <LoadingState
        title="Loading stock counts"
        description="Fetching governed count sessions for your warehouses."
      />
    );
  }

  if (sessionsQuery.isError) {
    return (
      <ErrorState
        title="Stock counts unavailable"
        description={toSafeApiErrorMessage(sessionsQuery.error, "Unable to load stock count sessions.")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumbs items={[{ label: "Inventory", href: "/inventory" }, { label: "Stock Counts" }]} />
      <InventorySectionNav />

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Stock Counts</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Physical counts post through the inventory ledger as adjustments. Balances are never overwritten directly.
          Flow: Draft → Open → Counting → Review → Approved → Posted.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Warehouse</span>
          <select
            value={warehouseId}
            onChange={(event) => setWarehouseId(event.target.value)}
            className="block min-w-[220px] rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">Select warehouse</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code ?? warehouse.id} — {warehouse.name ?? "Warehouse"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!warehouseId || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {createMutation.isPending ? "Creating..." : "Start cycle count"}
        </button>
      </section>

      {message ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No stock count sessions yet. Start a cycle count for a warehouse.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Warehouse</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const next =
                  row.status === "DRAFT"
                    ? "OPEN"
                    : row.status === "OPEN"
                      ? "COUNTING"
                      : row.status === "COUNTING"
                        ? "REVIEW"
                        : row.status === "REVIEW"
                          ? "APPROVED"
                          : row.status === "APPROVED"
                            ? "POSTED"
                            : null;
                return (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      {row.warehouse?.code ?? "—"} {row.warehouse?.name ? `(${row.warehouse.name})` : ""}
                    </td>
                    <td className="px-3 py-2">{row.countType}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{row.status}</span>
                      {row.blindCount ? <span className="ml-2 text-xs text-slate-500">Blind</span> : null}
                    </td>
                    <td className="px-3 py-2">{row._count?.lines ?? 0}</td>
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {next ? (
                        <button
                          type="button"
                          disabled={transitionMutation.isPending}
                          onClick={() => transitionMutation.mutate({ id: row.id, status: next })}
                          className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Move to {next}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">No further action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
