"use client";

import { useMemo } from "react";
import { Ellipsis, QrCode } from "lucide-react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/page-state";
import { formatDate as formatDateLk } from "@/lib/localization";
import type { AssetColumnKey } from "./use-asset-page-store";

export { resolveAssetDataColumnKeys } from "./assets-table-columns";

export type AssetTableCategory =
  | "MACHINE"
  | "TOOL"
  | "INFRASTRUCTURE"
  | "EQUIPMENT"
  | "VEHICLE"
  | "OTHER";

export type AssetTableStatus = "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "DISPOSED" | "RETIRED";

export type AssetTableCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL";

export type AssetTableRow = {
  id: string;
  assetTag: string;
  name: string;
  category: AssetTableCategory;
  status: AssetTableStatus;
  location?: string | null;
  condition: AssetTableCondition;
  lastServiceDate?: string | null;
  openWorkOrderCount?: number;
};

type StatusPromptState = {
  assetId: string;
  status: AssetTableStatus;
  reason: string;
};

const QUICK_STATUS_OPTIONS: Array<{ label: string; value: AssetTableStatus }> = [
  { label: "Active", value: "ACTIVE" },
  { label: "Under Maintenance", value: "UNDER_MAINTENANCE" },
  { label: "Retired", value: "RETIRED" },
  { label: "Disposed", value: "DISPOSED" }
];

const STATUS_STYLES: Record<AssetTableStatus, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  INACTIVE: "bg-slate-200 text-slate-700",
  UNDER_MAINTENANCE: "bg-amber-100 text-amber-800",
  RETIRED: "bg-slate-300 text-slate-700",
  DISPOSED: "bg-rose-100 text-rose-700"
};

const CONDITION_STYLES: Record<AssetTableCondition, string> = {
  EXCELLENT: "bg-sky-100 text-sky-700",
  GOOD: "bg-emerald-100 text-emerald-700",
  FAIR: "bg-amber-100 text-amber-800",
  POOR: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-rose-100 text-rose-700"
};

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return formatDateLk(value, { fallback: "-" });
}

function formatEnumLabel(value?: string | null) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCategoryLabel(category: AssetTableCategory) {
  return category === "INFRASTRUCTURE" ? "Facility" : formatEnumLabel(category);
}

type AssetRowActionsProps<T extends AssetTableRow> = {
  asset: T;
  openRowMenuId: string | null;
  statusPrompt: StatusPromptState | null;
  canEditFields: boolean;
  canChangeStatus: boolean;
  canCreate: boolean;
  canDelete: boolean;
  onToggleMenu: (assetId: string) => void;
  onOpenDetails: (assetId: string) => void;
  onEdit: (asset: T) => void;
  onSetStatusPrompt: (prompt: StatusPromptState | null) => void;
  onConfirmStatus: (input: { assetId: string; status: AssetTableStatus; reason?: string }) => void;
  onCreateWorkOrder: (asset: T) => void;
  onScheduleMaintenance: (asset: T) => void;
  onViewQr: (asset: T) => void;
  onDelete: (asset: T) => void;
  onDisposalReasonChange: (reason: string) => void;
};

function AssetRowActions<T extends AssetTableRow>({
  asset,
  openRowMenuId,
  statusPrompt,
  canEditFields,
  canChangeStatus,
  canCreate,
  canDelete,
  onToggleMenu,
  onOpenDetails,
  onEdit,
  onSetStatusPrompt,
  onConfirmStatus,
  onCreateWorkOrder,
  onScheduleMaintenance,
  onViewQr,
  onDelete,
  onDisposalReasonChange
}: AssetRowActionsProps<T>) {
  const deleteAllowed = canDelete && (asset.openWorkOrderCount ?? 0) === 0;
  const statusPromptForRow = statusPrompt?.assetId === asset.id ? statusPrompt : null;
  const menuOpen = openRowMenuId === asset.id;
  const menuId = `asset-row-menu-${asset.id}`;

  return (
    <div className="relative inline-flex w-full justify-end md:w-auto">
      <button
        type="button"
        onClick={() => onToggleMenu(asset.id)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        aria-label="Open row actions"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
      >
        <Ellipsis aria-hidden size={14} />
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            aria-label="Close row actions menu"
            className="fixed inset-0 z-40 bg-slate-900/25 md:hidden"
            onClick={() => onToggleMenu(asset.id)}
          />
          <div
            id={menuId}
            className="fixed inset-x-4 bottom-4 z-50 max-h-[min(70vh,24rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 text-left shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-11 md:w-64 md:max-h-none"
          >
          <button
            type="button"
            onClick={() => onOpenDetails(asset.id)}
            className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            View details
          </button>

          {canEditFields ? (
            <button
              type="button"
              onClick={() => onEdit(asset)}
              className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Edit
            </button>
          ) : null}

          {canChangeStatus ? (
            <div className="rounded-xl px-2 py-2">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Change status
              </p>
              <div className="space-y-1">
                {QUICK_STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onSetStatusPrompt({
                        assetId: asset.id,
                        status: option.value,
                        reason: ""
                      })
                    }
                    className="block min-h-11 w-full rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {statusPromptForRow ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
                  <p>Change status to {formatEnumLabel(statusPromptForRow.status)}?</p>
                  {statusPromptForRow.status === "DISPOSED" ? (
                    <input
                      value={statusPromptForRow.reason}
                      onChange={(event) => onDisposalReasonChange(event.target.value)}
                      placeholder="Disposal reason"
                      aria-label="Disposal reason"
                      className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                    />
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onConfirmStatus({
                          assetId: asset.id,
                          status: statusPromptForRow.status,
                          reason: statusPromptForRow.reason
                        })
                      }
                      className="min-h-11 rounded-full bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetStatusPrompt(null)}
                      className="min-h-11 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              onClick={() => onCreateWorkOrder(asset)}
              className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Create work order
            </button>
          ) : null}

          {canCreate ? (
            <button
              type="button"
              onClick={() => onScheduleMaintenance(asset)}
              className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Schedule maintenance
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onViewQr(asset)}
            className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          >
            View QR
          </button>

          {deleteAllowed ? (
            <button
              type="button"
              onClick={() => onDelete(asset)}
              className="block min-h-11 w-full rounded-xl px-3 py-2.5 text-left text-sm text-rose-700 transition hover:bg-rose-50"
            >
              Delete
            </button>
          ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export type AssetsTableProps<T extends AssetTableRow = AssetTableRow> = {
  rows: T[];
  visibleColumns: Record<AssetColumnKey, boolean>;
  selectedIds: string[];
  highlightedRowId: string | null;
  openRowMenuId: string | null;
  statusPrompt: StatusPromptState | null;
  canEditFields: boolean;
  canChangeStatus: boolean;
  canCreate: boolean;
  canDelete: boolean;
  emptyDescription: string;
  onClearFilters: () => void;
  onToggleRowSelection: (id: string) => void;
  onTogglePageSelection: (ids: string[], selected: boolean) => void;
  onOpenDetails: (assetId: string) => void;
  onToggleMenu: (assetId: string) => void;
  onEdit: (asset: T) => void;
  onSetStatusPrompt: (prompt: StatusPromptState | null) => void;
  onConfirmStatus: (input: { assetId: string; status: AssetTableStatus; reason?: string }) => void;
  onCreateWorkOrder: (asset: T) => void;
  onScheduleMaintenance: (asset: T) => void;
  onViewQr: (asset: T) => void;
  onDelete: (asset: T) => void;
  onDisposalReasonChange: (reason: string) => void;
};

export function AssetsTable<T extends AssetTableRow>({
  rows,
  visibleColumns,
  selectedIds,
  highlightedRowId,
  openRowMenuId,
  statusPrompt,
  canEditFields,
  canChangeStatus,
  canCreate,
  canDelete,
  emptyDescription,
  onClearFilters,
  onToggleRowSelection,
  onTogglePageSelection,
  onOpenDetails,
  onToggleMenu,
  onEdit,
  onSetStatusPrompt,
  onConfirmStatus,
  onCreateWorkOrder,
  onScheduleMaintenance,
  onViewQr,
  onDelete,
  onDisposalReasonChange
}: AssetsTableProps<T>) {
  const pageIds = rows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const columns = useMemo(() => {
    const next: DataTableColumn<T>[] = [];

    if (visibleColumns.assetTag) {
      next.push({
        id: "assetTag",
        header: "Asset Tag",
        mobileLabel: "Asset Tag",
        cell: (asset) => <span className="font-medium text-slate-900">{asset.assetTag}</span>
      });
    }

    if (visibleColumns.name) {
      next.push({
        id: "name",
        header: "Name",
        mobileLabel: "Name",
        cell: (asset) => asset.name
      });
    }

    if (visibleColumns.category) {
      next.push({
        id: "category",
        header: "Category",
        mobileLabel: "Category",
        cell: (asset) => formatCategoryLabel(asset.category)
      });
    }

    if (visibleColumns.status) {
      next.push({
        id: "status",
        header: "Status",
        mobileLabel: "Status",
        cell: (asset) => (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[asset.status]}`}>
            {formatEnumLabel(asset.status)}
          </span>
        )
      });
    }

    if (visibleColumns.location) {
      next.push({
        id: "location",
        header: "Location",
        mobileLabel: "Location",
        cell: (asset) => asset.location || "-"
      });
    }

    if (visibleColumns.condition) {
      next.push({
        id: "condition",
        header: "Condition",
        mobileLabel: "Condition",
        cell: (asset) => (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONDITION_STYLES[asset.condition]}`}>
            {formatEnumLabel(asset.condition)}
          </span>
        )
      });
    }

    if (visibleColumns.lastServiceDate) {
      next.push({
        id: "lastServiceDate",
        header: "Last Service",
        mobileLabel: "Last Service",
        hideOnMobile: true,
        cell: (asset) => formatDate(asset.lastServiceDate)
      });
    }

    if (visibleColumns.qr) {
      next.push({
        id: "qr",
        header: "QR",
        mobileLabel: "QR",
        cell: (asset) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onViewQr(asset);
            }}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            aria-label={`View QR code for ${asset.assetTag}`}
          >
            <QrCode aria-hidden size={14} /> View
          </button>
        )
      });
    }

    return next;
  }, [onViewQr, visibleColumns]);

  return (
    <DataTable
      ariaLabel="Asset registry"
      className="border-0 shadow-none rounded-none"
      columns={columns}
      emptyDescription={emptyDescription}
      emptyTitle="No assets matched the current filters"
      emptyActionLabel="Clear filters"
      onEmptyAction={onClearFilters}
      emptyState={
        <EmptyState
          actionLabel="Clear filters"
          description={emptyDescription}
          onAction={onClearFilters}
          title="No assets matched the current filters"
        />
      }
      getRowId={(row) => row.id}
      getRowLabel={(asset) => `Open details for ${asset.assetTag}`}
      leadingHeader={
        <input
          type="checkbox"
          aria-label="Select all assets on this page"
          checked={allPageSelected}
          onChange={(event) => onTogglePageSelection(pageIds, event.target.checked)}
        />
      }
      minWidth="960px"
      onRowClick={(asset) => onOpenDetails(asset.id)}
      renderLeadingCell={(asset) => (
        <input
          type="checkbox"
          aria-label={`Select ${asset.assetTag}`}
          checked={selectedIds.includes(asset.id)}
          onChange={() => onToggleRowSelection(asset.id)}
        />
      )}
      renderActions={
        visibleColumns.actions
          ? (asset) => (
              <AssetRowActions<T>
                asset={asset}
                canChangeStatus={canChangeStatus}
                canCreate={canCreate}
                canDelete={canDelete}
                canEditFields={canEditFields}
                onConfirmStatus={onConfirmStatus}
                onCreateWorkOrder={onCreateWorkOrder}
                onDelete={onDelete}
                onDisposalReasonChange={onDisposalReasonChange}
                onEdit={onEdit}
                onOpenDetails={onOpenDetails}
                onScheduleMaintenance={onScheduleMaintenance}
                onSetStatusPrompt={onSetStatusPrompt}
                onToggleMenu={onToggleMenu}
                onViewQr={onViewQr}
                openRowMenuId={openRowMenuId}
                statusPrompt={statusPrompt}
              />
            )
          : undefined
      }
      actionsHeader={<span className="sr-only">Actions</span>}
      rowClassName={(asset) => {
        const classes = ["cursor-pointer"];
        if (highlightedRowId === asset.id) {
          classes.push("bg-sky-50/70");
        }
        if (selectedIds.includes(asset.id)) {
          classes.push("bg-brand-50/40");
        }
        return classes.join(" ");
      }}
      rows={rows}
    />
  );
}
