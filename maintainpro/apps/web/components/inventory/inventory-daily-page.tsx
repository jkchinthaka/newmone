"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState, toSafeApiErrorMessage } from "@/components/ui/page-state";
import { PageBreadcrumbs } from "@/components/layout/page-breadcrumbs";

import { getDailyInventory } from "./api";
import { InventorySectionNav } from "./inventory-section-nav";

type DailyRow = {
  date: string;
  partId: string;
  partNumber?: string;
  partName?: string;
  warehouseCode?: string;
  opening: number;
  inbound: number;
  outbound: number;
  returned: number;
  adjustmentIn: number;
  adjustmentOut: number;
  transferIn: number;
  transferOut: number;
  closing: number;
};

export default function InventoryDailyPage() {
  const [preset, setPreset] = useState("today");
  const query = useQuery({
    queryKey: ["inventory", "daily", preset],
    queryFn: () => getDailyInventory({ preset })
  });

  const rows = ((query.data as { rows?: DailyRow[] } | null)?.rows ?? []) as DailyRow[];

  if (query.isLoading && !query.data) {
    return <LoadingState title="Loading daily inventory" description="Calculating opening and closing balances from the ledger." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        title="Unable to load daily inventory"
        description={toSafeApiErrorMessage(query.error, "Unable to load daily inventory.")}
      />
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <PageBreadcrumbs />
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Daily Inventory</h1>
        <p className="mt-1 text-sm text-slate-600">
          Closing = Opening + IN + Returns + Adjustment In − OUT − Transfer Out − Adjustment Out.
        </p>
      </div>
      <InventorySectionNav />
      <div className="flex flex-wrap gap-2">
        {[
          ["today", "Today"],
          ["yesterday", "Yesterday"],
          ["last_7_days", "Last 7 Days"],
          ["this_month", "This Month"]
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setPreset(value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              preset === value ? "border-brand-300 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Item</th>
              <th className="px-3 py-3">Warehouse</th>
              <th className="px-3 py-3">Opening</th>
              <th className="px-3 py-3">IN</th>
              <th className="px-3 py-3">OUT</th>
              <th className="px-3 py-3">Return</th>
              <th className="px-3 py-3">Adj In</th>
              <th className="px-3 py-3">Adj Out</th>
              <th className="px-3 py-3">Closing</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                  No ledger activity for this period.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.date}-${row.partId}-${row.warehouseCode ?? ""}`} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.partNumber ? `${row.partNumber} · ${row.partName}` : row.partId}</td>
                  <td className="px-3 py-2">{row.warehouseCode ?? "—"}</td>
                  <td className="px-3 py-2">{row.opening}</td>
                  <td className="px-3 py-2">{row.inbound + row.transferIn}</td>
                  <td className="px-3 py-2">{row.outbound}</td>
                  <td className="px-3 py-2">{row.returned}</td>
                  <td className="px-3 py-2">{row.adjustmentIn}</td>
                  <td className="px-3 py-2">{row.adjustmentOut}</td>
                  <td className="px-3 py-2 font-semibold">{row.closing}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
