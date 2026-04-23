import { AlertOctagon, BellRing, ChevronRight, Siren, TriangleAlert } from "lucide-react";

import { InventoryPart } from "./types";

type InventoryAlertsProps = {
  lowStockParts: InventoryPart[];
  outOfStockCount: number;
  pendingPurchaseOrders: number;
  onShowLowStock: () => void;
  onShowOutOfStock: () => void;
  onShowPendingPo: () => void;
};

export function InventoryAlerts({ lowStockParts, outOfStockCount, pendingPurchaseOrders, onShowLowStock, onShowOutOfStock, onShowPendingPo }: InventoryAlertsProps) {
  const sampleItems = lowStockParts.slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <button
        type="button"
        onClick={onShowLowStock}
        className="group rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-amber-700">Low Stock Alert</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">{lowStockParts.length}</p>
          </div>
          <TriangleAlert className="text-amber-700" size={18} />
        </div>
        <div className="mt-3 space-y-1 text-xs text-amber-900/85">
          {sampleItems.length > 0 ? (
            sampleItems.map((part) => <p key={part.id}>- {part.name}</p>)
          ) : (
            <p>No low-stock parts right now.</p>
          )}
        </div>
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
          Review low stock <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </div>
      </button>

      <button
        type="button"
        onClick={onShowOutOfStock}
        className="group rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Critical Stockout</p>
            <p className="mt-2 text-2xl font-semibold text-rose-900">{outOfStockCount}</p>
          </div>
          <AlertOctagon className="text-rose-700" size={18} />
        </div>
        <p className="mt-3 text-xs text-rose-900/85">Immediate restocking recommended for service continuity.</p>
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-rose-800">
          Show out-of-stock <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </div>
      </button>

      <button
        type="button"
        onClick={onShowPendingPo}
        className="group rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-indigo-700">Procurement Queue</p>
            <p className="mt-2 text-2xl font-semibold text-indigo-900">{pendingPurchaseOrders}</p>
          </div>
          {pendingPurchaseOrders > 0 ? <Siren className="text-indigo-700" size={18} /> : <BellRing className="text-indigo-700" size={18} />}
        </div>
        <p className="mt-3 text-xs text-indigo-900/85">Parts linked to suppliers with pending orders are prioritized.</p>
        <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-800">
          Focus pending suppliers <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
        </div>
      </button>
    </div>
  );
}
