"use client";

import type { ReactNode } from "react";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";

type FacilityEntityTableProps<T extends Record<string, unknown>> = {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  ariaLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  onRowClick?: (row: T) => void;
  renderActions?: (row: T) => ReactNode;
};

export function FacilityEntityTable<T extends Record<string, unknown>>({
  rows,
  columns,
  getRowId,
  ariaLabel,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
  renderActions
}: FacilityEntityTableProps<T>) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowId={getRowId}
      ariaLabel={ariaLabel}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyActionLabel={emptyActionLabel}
      onEmptyAction={onEmptyAction}
      onRowClick={onRowClick}
      renderActions={renderActions}
      actionsHeader="Actions"
      minWidth="720px"
    />
  );
}

export function FacilityStatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
