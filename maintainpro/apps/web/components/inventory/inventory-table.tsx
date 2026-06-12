import { Eye, PackageMinus, PackagePlus, Pencil, Trash2 } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

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
  const pageIds = parts.map((part) => part.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const columns: DataTableColumn<InventoryPart>[] = [
    {
      id: "part",
      header: "Part",
      mobileLabel: "Part",
      cell: (part) => (
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {part.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={part.images[0]} alt={part.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                {part.partNumber.slice(0, 2)}
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{part.name}</p>
            <p className="text-xs text-slate-500">{part.partNumber}</p>
          </div>
        </div>
      )
    },
    {
      id: "category",
      header: "Category",
      mobileLabel: "Category",
      cell: (part) => part.category
    },
    {
      id: "stockStatus",
      header: "Stock Status",
      mobileLabel: "Stock Status",
      cell: (part) => {
        const status = getStockStatus(part);
        const statusMeta = getStockStatusMeta(status);
        return (
          <div>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>
              {statusMeta.label}
            </span>
            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${statusMeta.meterTone}`}
                style={{ width: `${stockProgress(part)}%` }}
              />
            </div>
          </div>
        );
      }
    },
    {
      id: "currentStock",
      header: "Current Stock",
      mobileLabel: "Current Stock",
      cell: (part) => (
        <div>
          <p className="font-semibold text-slate-900">{part.quantityInStock}</p>
          <p className="text-xs text-slate-500">
            Min {part.minimumStock} / Reorder {part.reorderPoint}
          </p>
        </div>
      )
    },
    {
      id: "supplier",
      header: "Supplier",
      mobileLabel: "Supplier",
      hideOnMobile: true,
      cell: (part) => part.supplier?.name ?? "-"
    },
    {
      id: "unitCost",
      header: "Unit Cost",
      mobileLabel: "Unit Cost",
      cell: (part) => formatCurrency(part.unitCost)
    },
    {
      id: "totalValue",
      header: "Total Value",
      mobileLabel: "Total Value",
      cell: (part) => formatCurrency(part.quantityInStock * part.unitCost)
    },
    {
      id: "lastMovement",
      header: "Last Movement",
      mobileLabel: "Last Movement",
      hideOnMobile: true,
      cell: (part) => formatDate(getLastMovementDate(part))
    }
  ];

  return (
    <DataTable
      ariaLabel="Inventory parts"
      className="rounded-2xl"
      columns={columns}
      emptyDescription="No inventory parts match your current filters."
      emptyTitle="No inventory parts found"
      getRowId={(part) => part.id}
      leadingHeader={
        <input
          type="checkbox"
          checked={allPageSelected}
          aria-label="Select all parts on this page"
          onChange={(event) => onTogglePageSelection(event.target.checked, pageIds)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
        />
      }
      minWidth="1200px"
      pagination={{
        page,
        pageSize,
        totalItems,
        onPageChange
      }}
      renderActions={(part) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <button
            type="button"
            title="View details"
            aria-label={`View details for ${part.name}`}
            onClick={() => onViewDetails(part)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            title="Add stock"
            aria-label={`Add stock for ${part.name}`}
            onClick={() => onStockIn(part)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
          >
            <PackagePlus size={14} />
          </button>
          <button
            type="button"
            title="Deduct stock"
            aria-label={`Deduct stock for ${part.name}`}
            onClick={() => onStockOut(part)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-amber-200 text-amber-700 transition hover:bg-amber-50"
          >
            <PackageMinus size={14} />
          </button>
          <button
            type="button"
            title="Edit part"
            aria-label={`Edit ${part.name}`}
            onClick={() => onEdit(part)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-sky-200 text-sky-700 transition hover:bg-sky-50"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            title="Delete part"
            aria-label={`Delete ${part.name}`}
            onClick={() => onDelete(part)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-rose-200 text-rose-700 transition hover:bg-rose-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
      renderLeadingCell={(part) => (
        <input
          type="checkbox"
          checked={selectedIds.has(part.id)}
          aria-label={`Select ${part.name}`}
          onChange={() => onToggleRowSelection(part.id)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
        />
      )}
      rows={parts}
    />
  );
}
