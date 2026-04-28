"use client";

import { Download, FileSpreadsheet, Loader2, Printer, Tags, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  applyInventoryFilters,
  DEFAULT_FILTERS,
  derivePendingSupplierIds,
  downloadCsv,
  downloadXlsx,
  getErrorMessage,
  loadSavedFilters,
  printInventoryReport,
  saveFilters,
  toExportRows
} from "./helpers";
import { useInventoryMutations, useInventoryOverview, usePartDetailData } from "./hooks";
import { InventoryAlerts } from "./inventory-alerts";
import { InventoryCharts } from "./inventory-charts";
import { InventoryDetailsDrawer } from "./inventory-details-drawer";
import { InventoryFiltersBar } from "./inventory-filters-bar";
import { InventorySummaryCards, SummaryCardKey } from "./inventory-summary-cards";
import { InventoryTable } from "./inventory-table";
import { InventoryFilters, InventoryPart } from "./types";

const PAGE_SIZE = 10;

type StockDialogState = {
  open: boolean;
  mode: "in" | "out";
  part: InventoryPart | null;
  quantity: string;
  notes: string;
};

type EditDialogState = {
  open: boolean;
  part: InventoryPart | null;
  name: string;
  category: string;
  unitCost: string;
  minimumStock: string;
  reorderPoint: string;
  location: string;
};

export default function InventoryManagementPage() {
  const {
    partsQuery,
    suppliersQuery,
    lowStockQuery,
    purchaseOrdersQuery,
    usageTrendQuery,
    topUsedQuery,
    summary,
    insights
  } = useInventoryOverview();

  const { stockInMutation, stockOutMutation, updatePartMutation, deletePartMutation, bulkDeleteMutation, bulkCategoryMutation, refreshInventoryData } =
    useInventoryMutations();

  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [hydrated, setHydrated] = useState(false);
  const [activeCard, setActiveCard] = useState<SummaryCardKey>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryValue, setBulkCategoryValue] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [stockDialog, setStockDialog] = useState<StockDialogState>({
    open: false,
    mode: "in",
    part: null,
    quantity: "",
    notes: ""
  });

  const [editDialog, setEditDialog] = useState<EditDialogState>({
    open: false,
    part: null,
    name: "",
    category: "",
    unitCost: "",
    minimumStock: "",
    reorderPoint: "",
    location: ""
  });

  const [deleteTarget, setDeleteTarget] = useState<InventoryPart | null>(null);
  const [drawerPart, setDrawerPart] = useState<InventoryPart | null>(null);

  const { movementsQuery, purchaseHistoryQuery, workOrdersQuery } = usePartDetailData(drawerPart?.id);

  const parts = useMemo(() => partsQuery.data ?? [], [partsQuery.data]);
  const suppliers = useMemo(() => suppliersQuery.data ?? [], [suppliersQuery.data]);
  const lowStockParts = useMemo(() => lowStockQuery.data ?? [], [lowStockQuery.data]);
  const purchaseOrders = useMemo(() => purchaseOrdersQuery.data ?? [], [purchaseOrdersQuery.data]);

  const pendingSupplierIds = useMemo(() => derivePendingSupplierIds(purchaseOrders), [purchaseOrders]);

  const categories = useMemo(() => {
    return Array.from(new Set(parts.map((part) => part.category))).sort((a, b) => a.localeCompare(b));
  }, [parts]);

  const filteredParts = useMemo(() => {
    return applyInventoryFilters(parts, filters, pendingSupplierIds);
  }, [parts, filters, pendingSupplierIds]);

  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));

  const paginatedParts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredParts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredParts]);

  const selectedParts = useMemo(() => {
    return parts.filter((part) => selectedIds.has(part.id));
  }, [parts, selectedIds]);

  const isInitialLoading = partsQuery.isLoading && !partsQuery.data;
  const hasBlockingError = partsQuery.isError && !partsQuery.data;
  const mutationBusy =
    stockInMutation.isPending ||
    stockOutMutation.isPending ||
    updatePartMutation.isPending ||
    deletePartMutation.isPending ||
    bulkDeleteMutation.isPending ||
    bulkCategoryMutation.isPending;

  useEffect(() => {
    setFilters(loadSavedFilters(DEFAULT_FILTERS));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveFilters(filters);
  }, [filters, hydrated]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      const filtered = Array.from(prev).filter((id) => parts.some((part) => part.id === id));
      if (filtered.length === prev.size) {
        return prev;
      }
      return new Set(filtered);
    });
  }, [parts]);

  function handleCardSelection(card: SummaryCardKey) {
    const nextCard = activeCard === card ? "all" : card;
    setActiveCard(nextCard);
    setCurrentPage(1);

    if (nextCard === "all") {
      setFilters((prev) => ({ ...prev, stockStatus: "ALL", pendingPoOnly: false }));
      return;
    }

    if (nextCard === "low") {
      setFilters((prev) => ({ ...prev, stockStatus: "LOW", pendingPoOnly: false }));
      return;
    }

    if (nextCard === "critical") {
      setFilters((prev) => ({ ...prev, stockStatus: "CRITICAL", pendingPoOnly: false }));
      return;
    }

    if (nextCard === "out") {
      setFilters((prev) => ({ ...prev, stockStatus: "OUT_OF_STOCK", pendingPoOnly: false }));
      return;
    }

    if (nextCard === "pending") {
      setFilters((prev) => ({ ...prev, stockStatus: "ALL", pendingPoOnly: true }));
    }
  }

  function updateFilters(next: InventoryFilters) {
    setFilters(next);
    setCurrentPage(1);
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setActiveCard("all");
    setCurrentPage(1);
  }

  function toggleRowSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function togglePageSelection(checked: boolean, ids: string[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      for (const id of ids) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return next;
    });
  }

  async function submitStockDialog() {
    if (!stockDialog.part) {
      return;
    }

    const quantity = Number(stockDialog.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    if (stockDialog.mode === "out" && quantity > stockDialog.part.quantityInStock) {
      toast.error("Deducted quantity cannot exceed available stock.");
      return;
    }

    if (stockDialog.mode === "in") {
      await stockInMutation.mutateAsync({
        id: stockDialog.part.id,
        quantity,
        notes: stockDialog.notes || undefined
      });
    } else {
      await stockOutMutation.mutateAsync({
        id: stockDialog.part.id,
        quantity,
        notes: stockDialog.notes || undefined
      });
    }

    setStockDialog({ open: false, mode: "in", part: null, quantity: "", notes: "" });
  }

  async function submitEditDialog() {
    if (!editDialog.part) {
      return;
    }

    const unitCost = Number(editDialog.unitCost);
    const minimumStock = Number(editDialog.minimumStock);
    const reorderPoint = Number(editDialog.reorderPoint);

    if (!editDialog.name.trim() || !editDialog.category.trim()) {
      toast.error("Name and category are required.");
      return;
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      toast.error("Unit cost must be a valid number.");
      return;
    }

    if (!Number.isFinite(minimumStock) || !Number.isFinite(reorderPoint) || minimumStock < 0 || reorderPoint < 0) {
      toast.error("Minimum stock and reorder point must be valid numbers.");
      return;
    }

    await updatePartMutation.mutateAsync({
      id: editDialog.part.id,
      data: {
        name: editDialog.name.trim(),
        category: editDialog.category.trim(),
        unitCost,
        minimumStock,
        reorderPoint,
        location: editDialog.location.trim() || undefined
      }
    });

    setEditDialog({
      open: false,
      part: null,
      name: "",
      category: "",
      unitCost: "",
      minimumStock: "",
      reorderPoint: "",
      location: ""
    });
  }

  async function submitDeleteSingle() {
    if (!deleteTarget) {
      return;
    }

    await deletePartMutation.mutateAsync(deleteTarget.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });

    if (drawerPart?.id === deleteTarget.id) {
      setDrawerPart(null);
    }

    setDeleteTarget(null);
  }

  async function submitBulkDelete() {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) {
      return;
    }

    await bulkDeleteMutation.mutateAsync(ids);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
  }

  async function submitBulkCategory() {
    const ids = Array.from(selectedIds);

    if (ids.length === 0) {
      toast.error("Select at least one row to update category.");
      return;
    }

    if (!bulkCategoryValue.trim()) {
      toast.error("Category is required for bulk update.");
      return;
    }

    await bulkCategoryMutation.mutateAsync({ ids, category: bulkCategoryValue.trim() });
    setBulkCategoryValue("");
  }

  function openStockDialog(part: InventoryPart, mode: "in" | "out") {
    setStockDialog({
      open: true,
      mode,
      part,
      quantity: "",
      notes: ""
    });
  }

  function openEditDialog(part: InventoryPart) {
    setEditDialog({
      open: true,
      part,
      name: part.name,
      category: part.category,
      unitCost: String(part.unitCost),
      minimumStock: String(part.minimumStock),
      reorderPoint: String(part.reorderPoint),
      location: part.location ?? ""
    });
  }

  function exportSelectedCsv() {
    if (selectedParts.length === 0) {
      toast.error("Select one or more rows before exporting.");
      return;
    }

    downloadCsv(toExportRows(selectedParts), `inventory-selected-${Date.now()}.csv`);
    toast.success("Selected parts exported to CSV.");
  }

  function exportSelectedXlsx() {
    if (selectedParts.length === 0) {
      toast.error("Select one or more rows before exporting.");
      return;
    }

    downloadXlsx(toExportRows(selectedParts), `inventory-selected-${Date.now()}.xlsx`);
    toast.success("Selected parts exported to XLSX.");
  }

  function printSelected() {
    if (selectedParts.length === 0) {
      toast.error("Select one or more rows before printing.");
      return;
    }

    printInventoryReport(selectedParts, "Inventory Report - Selected Parts");
  }

  function exportLowStockReport() {
    if (lowStockParts.length === 0) {
      toast.error("No low-stock records to export.");
      return;
    }

    downloadCsv(toExportRows(lowStockParts), `inventory-low-stock-${Date.now()}.csv`);
    toast.success("Low stock report downloaded.");
  }

  if (isInitialLoading) {
    return <InventoryPageSkeleton />;
  }

  if (hasBlockingError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-900">Unable to load inventory data</p>
        <p className="mt-1 text-sm text-rose-800">{getErrorMessage(partsQuery.error)}</p>
        <button
          type="button"
          onClick={() => refreshInventoryData()}
          className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-blue-900 to-sky-800 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-sky-200">Inventory Intelligence</p>
            <h1 className="mt-2 text-3xl font-semibold">Spare Parts Command Center</h1>
            <p className="mt-2 text-sm text-sky-100">Real-time stock control, analytics, and procurement visibility in one premium workspace.</p>
          </div>

          {mutationBusy ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs text-sky-50">
              <Loader2 size={14} className="animate-spin" />
              Syncing updates...
            </div>
          ) : null}
        </div>
      </div>

      <InventorySummaryCards summary={summary} insights={insights} activeCard={activeCard} onCardSelect={handleCardSelection} />

      <InventoryAlerts
        lowStockParts={lowStockParts}
        outOfStockCount={summary.outOfStockCount}
        pendingPurchaseOrders={summary.pendingPurchaseOrders}
        onShowLowStock={() => handleCardSelection("low")}
        onShowOutOfStock={() => handleCardSelection("out")}
        onShowPendingPo={() => handleCardSelection("pending")}
      />

      <InventoryCharts usageTrend={usageTrendQuery.data ?? []} topUsedParts={topUsedQuery.data ?? []} />

      <InventoryFiltersBar
        filters={filters}
        categories={categories}
        suppliers={suppliers}
        selectedCount={selectedIds.size}
        onFiltersChange={updateFilters}
        onReset={resetFilters}
        onExportLowStock={exportLowStockReport}
      />

      {selectedIds.size > 0 ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-brand-800">{selectedIds.size} part(s) selected</p>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-white px-2 py-1.5">
                <Tags size={14} className="text-brand-700" />
                <input
                  value={bulkCategoryValue}
                  onChange={(event) => setBulkCategoryValue(event.target.value)}
                  placeholder="Bulk category"
                  className="w-36 bg-transparent text-xs outline-none placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void submitBulkCategory()}
                  className="rounded-md bg-brand-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-700"
                >
                  Apply
                </button>
              </div>

              <button
                type="button"
                onClick={exportSelectedCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Download size={14} /> CSV
              </button>

              <button
                type="button"
                onClick={exportSelectedXlsx}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FileSpreadsheet size={14} /> XLSX
              </button>

              <button
                type="button"
                onClick={printSelected}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <Printer size={14} /> Print
              </button>

              <button
                type="button"
                onClick={() => setBulkDeleteOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <Trash2 size={14} /> Bulk Delete
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <InventoryTable
        parts={paginatedParts}
        totalItems={filteredParts.length}
        page={currentPage}
        pageSize={PAGE_SIZE}
        selectedIds={selectedIds}
        onPageChange={setCurrentPage}
        onToggleRowSelection={toggleRowSelection}
        onTogglePageSelection={togglePageSelection}
        onViewDetails={(part) => setDrawerPart(part)}
        onStockIn={(part) => openStockDialog(part, "in")}
        onStockOut={(part) => openStockDialog(part, "out")}
        onEdit={openEditDialog}
        onDelete={setDeleteTarget}
      />

      <InventoryDetailsDrawer
        open={Boolean(drawerPart)}
        part={drawerPart}
        movements={movementsQuery.data ?? []}
        movementsLoading={movementsQuery.isLoading}
        purchaseHistory={purchaseHistoryQuery.data ?? []}
        purchaseHistoryLoading={purchaseHistoryQuery.isLoading}
        workOrders={workOrdersQuery.data ?? []}
        workOrdersLoading={workOrdersQuery.isLoading}
        onClose={() => setDrawerPart(null)}
      />

      <ModalShell
        open={stockDialog.open}
        title={stockDialog.mode === "in" ? "Add Stock" : "Deduct Stock"}
        onClose={() => setStockDialog({ open: false, mode: "in", part: null, quantity: "", notes: "" })}
        footer={
          <>
            <button
              type="button"
              onClick={() => setStockDialog({ open: false, mode: "in", part: null, quantity: "", notes: "" })}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitStockDialog()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              Save
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          {stockDialog.part?.name} ({stockDialog.part?.partNumber})
        </p>
        <div className="mt-3 grid gap-3">
          <input
            type="number"
            min={1}
            value={stockDialog.quantity}
            onChange={(event) => setStockDialog((prev) => ({ ...prev, quantity: event.target.value }))}
            placeholder="Quantity"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <textarea
            value={stockDialog.notes}
            onChange={(event) => setStockDialog((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="Optional note"
            rows={3}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </ModalShell>

      <ModalShell
        open={editDialog.open}
        title="Edit Inventory Part"
        onClose={() =>
          setEditDialog({ open: false, part: null, name: "", category: "", unitCost: "", minimumStock: "", reorderPoint: "", location: "" })
        }
        footer={
          <>
            <button
              type="button"
              onClick={() =>
                setEditDialog({ open: false, part: null, name: "", category: "", unitCost: "", minimumStock: "", reorderPoint: "", location: "" })
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitEditDialog()}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
            >
              Save Changes
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={editDialog.name}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Part name"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 sm:col-span-2"
          />
          <input
            value={editDialog.category}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Category"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="number"
            min={0}
            step="0.01"
            value={editDialog.unitCost}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, unitCost: event.target.value }))}
            placeholder="Unit cost"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="number"
            min={0}
            value={editDialog.minimumStock}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, minimumStock: event.target.value }))}
            placeholder="Minimum stock"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <input
            type="number"
            min={0}
            value={editDialog.reorderPoint}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, reorderPoint: event.target.value }))}
            placeholder="Reorder point"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
          />
          <input
            value={editDialog.location}
            onChange={(event) => setEditDialog((prev) => ({ ...prev, location: event.target.value }))}
            placeholder="Location"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100 sm:col-span-2"
          />
        </div>
      </ModalShell>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete inventory part?"
        description={`This will remove ${deleteTarget?.name ?? "this part"} from active inventory.`}
        confirmLabel="Delete"
        confirmTone="danger"
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void submitDeleteSingle()}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected parts?"
        description={`You are about to delete ${selectedIds.size} selected part(s). This action can be reverted only by re-creating parts.`}
        confirmLabel="Delete Selected"
        confirmTone="danger"
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={() => void submitBulkDelete()}
      />
    </div>
  );
}

function InventoryPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
      <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
    </div>
  );
}

type ModalShellProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
};

function ModalShell({ open, title, onClose, footer, children }: ModalShellProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4">{children}</div>

        <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone: "default" | "danger";
  onClose: () => void;
  onConfirm: () => void;
};

function ConfirmModal({ open, title, description, confirmLabel, confirmTone, onClose, onConfirm }: ConfirmModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        <h4 className="text-base font-semibold text-slate-900">{title}</h4>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition ${
              confirmTone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
