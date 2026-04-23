import { Eye, PackageMinus, PackagePlus, Pencil, Trash2 } from "lucide-react";

import { formatCurrency, formatDate, getLastMovementDate, getStockStatus, getStockStatusMeta, stockProgress } from "./helpers";
import { InventoryPart } from "./types";

type InventoryTableProps = {
  parts: InventoryPart[];
  totalItems: number;
  page: number;
  pageSize: number;
  selectedIds: Set<string>;
  onPageChange: (page: number) => void;
  onToggleRowSelection: (id: string) => void;
  onTogglePageSelection: (checked: boolean, ids: string[]) => void;
  onViewDetails: (part: InventoryPart) => void;
  onStockIn: (part: InventoryPart) => void;
  onStockOut: (part: InventoryPart) => void;
  onEdit: (part: InventoryPart) => void;
  onDelete: (part: InventoryPart) => void;
};

export function InventoryTable({
  parts,
  totalItems,
  page,
  pageSize,
  selectedIds,
  onPageChange,
  onToggleRowSelection,
  onTogglePageSelection,
  onViewDetails,
  onStockIn,
  onStockOut,
  onEdit,
  onDelete
}: InventoryTableProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pageIds = parts.map((part) => part.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1200px] w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(event) => onTogglePageSelection(event.target.checked, pageIds)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
              </th>
              <th className="px-2 py-3">Part</th>
              <th className="px-2 py-3">Category</th>
              <th className="px-2 py-3">Stock Status</th>
              <th className="px-2 py-3">Current Stock</th>
              <th className="px-2 py-3">Supplier</th>
              <th className="px-2 py-3">Unit Cost</th>
              <th className="px-2 py-3">Total Value</th>
              <th className="px-2 py-3">Last Movement</th>
              <th className="px-2 py-3 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {parts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-500">
                  No inventory parts match your current filters.
                </td>
              </tr>
            ) : (
              parts.map((part) => {
                const status = getStockStatus(part);
                const statusMeta = getStockStatusMeta(status);
                const lastMovement = getLastMovementDate(part);

                return (
                  <tr key={part.id} className="border-b border-slate-100 transition hover:bg-brand-50/40">
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(part.id)}
                        onChange={() => onToggleRowSelection(part.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                      />
                    </td>

                    <td className="px-2 py-3 align-top">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {part.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={part.images[0]} alt={part.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">{part.partNumber.slice(0, 2)}</div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{part.name}</p>
                          <p className="text-xs text-slate-500">{part.partNumber}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-2 py-3 align-top text-slate-700">{part.category}</td>

                    <td className="px-2 py-3 align-top">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>{statusMeta.label}</span>
                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
                        <div className={`h-full rounded-full ${statusMeta.meterTone}`} style={{ width: `${stockProgress(part)}%` }} />
                      </div>
                    </td>

                    <td className="px-2 py-3 align-top">
                      <p className="font-semibold text-slate-900">{part.quantityInStock}</p>
                      <p className="text-xs text-slate-500">
                        Min {part.minimumStock} / Reorder {part.reorderPoint}
                      </p>
                    </td>

                    <td className="px-2 py-3 align-top text-slate-700">{part.supplier?.name ?? "-"}</td>

                    <td className="px-2 py-3 align-top text-slate-700">{formatCurrency(part.unitCost)}</td>

                    <td className="px-2 py-3 align-top font-semibold text-slate-900">{formatCurrency(part.quantityInStock * part.unitCost)}</td>

                    <td className="px-2 py-3 align-top text-slate-700">{formatDate(lastMovement)}</td>

                    <td className="px-2 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="View details"
                          onClick={() => onViewDetails(part)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          title="Add stock"
                          onClick={() => onStockIn(part)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                        >
                          <PackagePlus size={14} />
                        </button>
                        <button
                          type="button"
                          title="Deduct stock"
                          onClick={() => onStockOut(part)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-700 transition hover:bg-amber-50"
                        >
                          <PackageMinus size={14} />
                        </button>
                        <button
                          type="button"
                          title="Edit part"
                          onClick={() => onEdit(part)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 text-sky-700 transition hover:bg-sky-50"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Delete part"
                          onClick={() => onDelete(part)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
        <p className="text-slate-600">
          Showing <span className="font-semibold text-slate-900">{Math.min(totalItems, (page - 1) * pageSize + 1)}</span> to{" "}
          <span className="font-semibold text-slate-900">{Math.min(totalItems, page * pageSize)}</span> of <span className="font-semibold text-slate-900">{totalItems}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs font-medium text-slate-600">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
