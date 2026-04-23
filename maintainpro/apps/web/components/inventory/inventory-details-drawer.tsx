import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ClipboardList, PackageCheck, PackageSearch, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { estimateRunoutDays, formatCurrency, formatDate, formatDateTime, getStockStatus, getStockStatusMeta } from "./helpers";
import { InventoryPart, LinkedWorkOrder, PurchaseOrder, StockMovement } from "./types";

type DrawerTab = "overview" | "movements" | "purchase" | "workorders";

type InventoryDetailsDrawerProps = {
  open: boolean;
  part: InventoryPart | null;
  movements: StockMovement[];
  movementsLoading: boolean;
  purchaseHistory: PurchaseOrder[];
  purchaseHistoryLoading: boolean;
  workOrders: LinkedWorkOrder[];
  workOrdersLoading: boolean;
  onClose: () => void;
};

const tabs: Array<{ key: DrawerTab; label: string; icon: typeof PackageCheck }> = [
  { key: "overview", label: "Overview", icon: PackageCheck },
  { key: "movements", label: "Stock Movements", icon: CalendarClock },
  { key: "purchase", label: "Purchase History", icon: ClipboardList },
  { key: "workorders", label: "Linked Work Orders", icon: Wrench }
];

export function InventoryDetailsDrawer({
  open,
  part,
  movements,
  movementsLoading,
  purchaseHistory,
  purchaseHistoryLoading,
  workOrders,
  workOrdersLoading,
  onClose
}: InventoryDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
    }
  }, [open, part?.id]);

  const statusMeta = part ? getStockStatusMeta(getStockStatus(part)) : null;

  const runoutDays = useMemo(() => {
    if (!part) {
      return null;
    }

    return estimateRunoutDays(part, movements);
  }, [movements, part]);

  return (
    <AnimatePresence>
      {open && part ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm"
            aria-label="Close drawer overlay"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
          >
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 p-4 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Inventory Part Details</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{part.name}</h3>
                  <p className="text-sm text-slate-500">{part.partNumber}</p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-semibold ${statusMeta?.tone ?? ""}`}>{statusMeta?.label}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Stock: {part.quantityInStock}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Category: {part.category}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.key === activeTab;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        isActive ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <Icon size={14} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 p-4">
              {activeTab === "overview" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricTile label="Current Stock" value={String(part.quantityInStock)} />
                    <MetricTile label="Unit Cost" value={formatCurrency(part.unitCost)} />
                    <MetricTile label="Estimated Value" value={formatCurrency(part.quantityInStock * part.unitCost)} />
                    <MetricTile label="Runout Estimate" value={runoutDays === null ? "Not enough data" : `${Math.ceil(runoutDays)} day(s)`} />
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Stock Policy</p>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      <p>Minimum stock: {part.minimumStock}</p>
                      <p>Reorder point: {part.reorderPoint}</p>
                      <p>Supplier: {part.supplier?.name ?? "-"}</p>
                      <p>Location: {part.location ?? "-"}</p>
                      <p>Last updated: {formatDateTime(part.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-semibold text-slate-900">Smart Recommendation</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {runoutDays !== null && runoutDays <= 14
                        ? "This part may run out within two weeks. Prioritize purchase order follow-up."
                        : "Current consumption rate looks stable. Keep monitoring stock movement weekly."}
                    </p>
                  </div>
                </div>
              ) : null}

              {activeTab === "movements" ? (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Movement Timeline</p>
                  </div>
                  <div className="max-h-[480px] overflow-y-auto">
                    {movementsLoading ? (
                      <div className="space-y-2 p-4">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                        ))}
                      </div>
                    ) : movements.length > 0 ? (
                      <ul className="divide-y divide-slate-100">
                        {movements.map((movement) => (
                          <li key={movement.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className={`text-sm font-semibold ${movement.type === "OUT" ? "text-rose-700" : "text-emerald-700"}`}>
                                  {movement.type === "OUT" ? "Stock Out" : "Stock In"} ({movement.quantity})
                                </p>
                                <p className="mt-1 text-xs text-slate-500">Reference: {movement.reference ?? "-"}</p>
                                <p className="mt-1 text-xs text-slate-600">{movement.notes ?? "No note provided"}</p>
                              </div>
                              <p className="text-xs text-slate-500">{formatDateTime(movement.createdAt)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="px-4 py-10 text-center text-sm text-slate-500">No movement history for this part yet.</div>
                    )}
                  </div>
                </div>
              ) : null}

              {activeTab === "purchase" ? (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Purchase History</p>
                    <p className="text-xs text-slate-500">Shown at supplier level because purchase orders are stored per supplier.</p>
                  </div>
                  {purchaseHistoryLoading ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                      ))}
                    </div>
                  ) : purchaseHistory.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">PO #</th>
                            <th className="px-2 py-3">Order Date</th>
                            <th className="px-2 py-3">Expected</th>
                            <th className="px-2 py-3">Status</th>
                            <th className="px-2 py-3 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {purchaseHistory.map((order) => (
                            <tr key={order.id} className="border-b border-slate-100">
                              <td className="px-4 py-3 font-semibold text-slate-800">{order.poNumber}</td>
                              <td className="px-2 py-3 text-slate-700">{formatDate(order.orderDate)}</td>
                              <td className="px-2 py-3 text-slate-700">{formatDate(order.expectedDate)}</td>
                              <td className="px-2 py-3 text-slate-700">{order.status.replaceAll("_", " ")}</td>
                              <td className="px-2 py-3 text-right font-semibold text-slate-900">{formatCurrency(order.totalAmount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-500">No purchase history available for this supplier.</div>
                  )}
                </div>
              ) : null}

              {activeTab === "workorders" ? (
                <div className="rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">Linked Work Orders</p>
                  </div>

                  {workOrdersLoading ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100" />
                      ))}
                    </div>
                  ) : workOrders.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">WO #</th>
                            <th className="px-2 py-3">Title</th>
                            <th className="px-2 py-3">Status</th>
                            <th className="px-2 py-3">Used Qty</th>
                            <th className="px-2 py-3">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workOrders.map((workOrder) => {
                            const partUsage = workOrder.parts?.[0];

                            return (
                              <tr key={workOrder.id} className="border-b border-slate-100">
                                <td className="px-4 py-3 font-semibold text-slate-800">{workOrder.woNumber}</td>
                                <td className="px-2 py-3 text-slate-700">{workOrder.title}</td>
                                <td className="px-2 py-3 text-slate-700">{workOrder.status}</td>
                                <td className="px-2 py-3 text-slate-700">{partUsage?.quantity ?? 0}</td>
                                <td className="px-2 py-3 text-slate-700">{formatDate(workOrder.createdAt)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-slate-500">
                      <PackageSearch size={18} className="text-slate-400" />
                      No work orders currently linked to this part.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
