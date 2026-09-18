"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";
import { apiClient } from "@/lib/api-client";

import {
  createStockCount,
  getStockCount,
  listStockCounts,
  transitionStockCount,
  upsertStockCountLine
} from "./api";
import { InventorySectionNav } from "./inventory-section-nav";

type StockCountRow = {
  id: string;
  status: string;
  countType: string;
  blindCount: boolean;
  createdAt: string;
  warehouseId?: string;
  warehouse?: { code?: string; name?: string };
  _count?: { lines: number };
};

type StockCountLine = {
  id: string;
  partId: string;
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  notes?: string | null;
  part?: { partNumber?: string; name?: string };
};

type StockCountDetail = StockCountRow & {
  lines?: StockCountLine[];
};

type PartOption = { id: string; partNumber?: string; name?: string };

export default function InventoryStockCountsPage() {
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [partId, setPartId] = useState("");
  const [countedQuantity, setCountedQuantity] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "warehouses"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/warehouses");
      const data = response.data?.data ?? response.data ?? [];
      return Array.isArray(data) ? data : [];
    }
  });

  const partsQuery = useQuery({
    queryKey: ["inventory", "parts", "stock-count"],
    queryFn: async () => {
      const response = await apiClient.get("/inventory/parts");
      const data = response.data?.data ?? response.data ?? [];
      return (Array.isArray(data) ? data : []) as PartOption[];
    }
  });

  const sessionsQuery = useQuery({
    queryKey: ["inventory", "stock-counts"],
    queryFn: () => listStockCounts()
  });

  const detailQuery = useQuery({
    queryKey: ["inventory", "stock-counts", selectedId],
    queryFn: () => getStockCount(selectedId!),
    enabled: Boolean(selectedId)
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!warehouseId) throw new Error("Select a warehouse first");
      return createStockCount({ warehouseId, countType: "CYCLE" });
    },
    onSuccess: async (created) => {
      const id = (created as { id?: string } | null)?.id;
      setMessage("Stock count session created as Draft. Enter counted quantities, then move through Review → Approved → Posted.");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
      if (id) setSelectedId(id);
    },
    onError: (error) => setMessage(toSafeApiErrorMessage(error, "Could not create stock count"))
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => transitionStockCount(id, status),
    onSuccess: async () => {
      setMessage("Stock count status updated.");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
      if (selectedId) {
        await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts", selectedId] });
      }
    },
    onError: (error) => setMessage(toSafeApiErrorMessage(error, "Could not update stock count status"))
  });

  const lineMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) throw new Error("Select a stock count session");
      if (!partId) throw new Error("Select a part");
      const qty = Number(countedQuantity);
      if (!Number.isFinite(qty) || qty < 0) throw new Error("Enter a non-negative counted quantity");
      return upsertStockCountLine(selectedId, { partId, countedQuantity: qty });
    },
    onSuccess: async () => {
      setMessage("Count line saved. Variances post only after approval through the inventory ledger.");
      setCountedQuantity("");
      await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts"] });
      if (selectedId) {
        await queryClient.invalidateQueries({ queryKey: ["inventory", "stock-counts", selectedId] });
      }
    },
    onError: (error) => setMessage(toSafeApiErrorMessage(error, "Could not save count line"))
  });

  const rows = (sessionsQuery.data as StockCountRow[] | null) ?? [];
  const warehouses = (warehousesQuery.data as Array<{ id: string; code?: string; name?: string }>) ?? [];
  const parts = partsQuery.data ?? [];
  const detail = detailQuery.data as StockCountDetail | null;
  const lines = detail?.lines ?? [];
  const canEditLines = detail ? ["DRAFT", "OPEN", "COUNTING", "REVIEW"].includes(detail.status) : false;

  const nextStatus = useMemo(() => {
    if (!detail) return null;
    if (detail.status === "DRAFT") return "OPEN";
    if (detail.status === "OPEN") return "COUNTING";
    if (detail.status === "COUNTING") return "REVIEW";
    if (detail.status === "REVIEW") return "APPROVED";
    if (detail.status === "APPROVED") return "POSTED";
    return null;
  }, [detail]);

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
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={`border-b border-slate-100 ${selectedId === row.id ? "bg-brand-50/40" : ""}`}>
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
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId ? (
        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4" aria-label="Stock count detail">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Session detail</h2>
              <p className="text-sm text-slate-600">
                Status: <span className="font-medium">{detail?.status ?? "…"}</span>
                {detail?.warehouse?.code ? ` · ${detail.warehouse.code}` : ""}
              </p>
            </div>
            {nextStatus ? (
              <button
                type="button"
                disabled={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate({ id: selectedId, status: nextStatus })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                Move to {nextStatus}
              </button>
            ) : null}
          </div>

          {detailQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading lines…</p>
          ) : detailQuery.isError ? (
            <p className="text-sm text-red-700" role="alert">
              {toSafeApiErrorMessage(detailQuery.error, "Unable to load session detail.")}
            </p>
          ) : (
            <>
              {canEditLines ? (
                <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Part</span>
                    <select
                      value={partId}
                      onChange={(event) => setPartId(event.target.value)}
                      className="block min-w-[240px] rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select part</option>
                      {parts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.partNumber ?? part.id} — {part.name ?? "Part"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="font-medium">Counted quantity</span>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={countedQuantity}
                      onChange={(event) => setCountedQuantity(event.target.value)}
                      className="block w-36 rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={lineMutation.isPending || !partId || countedQuantity === ""}
                    onClick={() => lineMutation.mutate()}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {lineMutation.isPending ? "Saving…" : "Save count line"}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-600">Counted quantities are locked after approval.</p>
              )}

              {lines.length === 0 ? (
                <p className="text-sm text-slate-600">No count lines yet. Add at least one counted quantity before review.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Part</th>
                        <th className="px-3 py-2">Expected</th>
                        <th className="px-3 py-2">Counted</th>
                        <th className="px-3 py-2">Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            {line.part?.partNumber
                              ? `${line.part.partNumber} · ${line.part.name ?? ""}`
                              : line.partId}
                          </td>
                          <td className="px-3 py-2">{detail?.blindCount ? "—" : line.expectedQuantity}</td>
                          <td className="px-3 py-2">{line.countedQuantity ?? "—"}</td>
                          <td className="px-3 py-2">{detail?.blindCount ? "—" : (line.variance ?? "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
