import { ArrowDownAZ, ArrowUpAZ, Download, Filter, RotateCcw, Search } from "lucide-react";

import { InventoryFilters, SupplierRecord } from "./types";

type InventoryFiltersBarProps = {
  filters: InventoryFilters;
  categories: string[];
  suppliers: SupplierRecord[];
  selectedCount: number;
  onFiltersChange: (next: InventoryFilters) => void;
  onReset: () => void;
  onExportLowStock: () => void;
};

export function InventoryFiltersBar({ filters, categories, suppliers, selectedCount, onFiltersChange, onReset, onExportLowStock }: InventoryFiltersBarProps) {
  function setFilter<K extends keyof InventoryFilters>(key: K, value: InventoryFilters[K]) {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }

  return (
    <div className="sticky top-2 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          <Filter size={14} />
          Advanced Filters
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onExportLowStock}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <Download size={14} />
            Export Low Stock Report
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-12">
        <label className="relative lg:col-span-3">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(event) => setFilter("search", event.target.value)}
            placeholder="Search by name or part number"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <select
          value={filters.stockStatus}
          onChange={(event) => setFilter("stockStatus", event.target.value as InventoryFilters["stockStatus"])}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 lg:col-span-2"
        >
          <option value="ALL">All Statuses</option>
          <option value="IN_STOCK">In Stock</option>
          <option value="LOW">Low</option>
          <option value="CRITICAL">Critical</option>
          <option value="OUT_OF_STOCK">Out of Stock</option>
        </select>

        <select
          value={filters.category}
          onChange={(event) => setFilter("category", event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 lg:col-span-2"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={filters.supplierId}
          onChange={(event) => setFilter("supplierId", event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 lg:col-span-2"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <input
            type="number"
            min={0}
            value={filters.minStock}
            onChange={(event) => setFilter("minStock", event.target.value === "" ? "" : Number(event.target.value))}
            placeholder="Min stock"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="number"
            min={0}
            value={filters.maxStock}
            onChange={(event) => setFilter("maxStock", event.target.value === "" ? "" : Number(event.target.value))}
            placeholder="Max stock"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div className="flex items-center gap-2 lg:col-span-1">
          <select
            value={filters.sortBy}
            onChange={(event) => setFilter("sortBy", event.target.value as InventoryFilters["sortBy"])}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          >
            <option value="name">Name</option>
            <option value="stock">Stock</option>
            <option value="unitCost">Unit Cost</option>
            <option value="lastMovement">Last Movement</option>
            <option value="category">Category</option>
          </select>
          <button
            type="button"
            title="Toggle sort direction"
            onClick={() => setFilter("sortDirection", filters.sortDirection === "asc" ? "desc" : "asc")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100"
          >
            {filters.sortDirection === "asc" ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={filters.pendingPoOnly}
            onChange={(event) => setFilter("pendingPoOnly", event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
          />
          Show only parts from suppliers with pending purchase orders
        </label>

        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{selectedCount} row(s) selected</span>
      </div>
    </div>
  );
}
