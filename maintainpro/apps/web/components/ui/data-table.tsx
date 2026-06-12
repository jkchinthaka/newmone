"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { EmptyState } from "@/components/ui/page-state";
import { toSortAriaSort } from "@/lib/accessibility";
import { getVisibleMobileColumns } from "@/lib/data-table-mobile";
import { getPaginationMeta, type SortDirection } from "@/lib/client-table";

export type { SortDirection };

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  mobileLabel?: string;
  hideOnMobile?: boolean;
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export type DataTableProps<T> = {
  rows: readonly T[];
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  ariaLabel: string;
  minWidth?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyState?: ReactNode;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  onSortChange?: (columnId: string) => void;
  leadingHeader?: ReactNode;
  renderLeadingCell?: (row: T) => ReactNode;
  renderActions?: (row: T) => ReactNode;
  actionsHeader?: ReactNode;
  onRowClick?: (row: T) => void;
  getRowLabel?: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  pagination?: DataTablePagination;
  className?: string;
};

function SortIndicator({
  active,
  direction
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return <ArrowUpDown aria-hidden className="h-3.5 w-3.5 text-slate-400" />;
  }

  return direction === "asc" ? (
    <ArrowUp aria-hidden className="h-3.5 w-3.5 text-brand-600" />
  ) : (
    <ArrowDown aria-hidden className="h-3.5 w-3.5 text-brand-600" />
  );
}

export function DataTablePaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange
}: DataTablePagination) {
  const meta = getPaginationMeta(totalItems, page, pageSize);

  return (
    <nav aria-label="Table pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm">
      <p className="text-slate-600">
        Showing{" "}
        <span className="font-semibold text-slate-900">{meta.start}</span> to{" "}
        <span className="font-semibold text-slate-900">{meta.end}</span> of{" "}
        <span className="font-semibold text-slate-900">{meta.totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Previous page"
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-xs font-medium text-slate-600" aria-live="polite">
          Page {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          aria-label="Next page"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          className="min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  ariaLabel,
  minWidth = "640px",
  emptyTitle = "No records found",
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  emptyState,
  sortKey,
  sortDirection = "asc",
  onSortChange,
  leadingHeader,
  renderLeadingCell,
  renderActions,
  actionsHeader = "Actions",
  onRowClick,
  getRowLabel,
  rowClassName,
  pagination,
  className = ""
}: DataTableProps<T>) {
  const visibleMobileColumns = getVisibleMobileColumns(columns);
  const hasActions = Boolean(renderActions);

  const emptyContent =
    emptyState ??
    (
      <EmptyState
        actionLabel={emptyActionLabel}
        description={emptyDescription}
        onAction={onEmptyAction}
        title={emptyTitle}
      />
    );

  return (
    <div className={`overflow-x-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`.trim()}>
      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <table
            aria-label={ariaLabel}
            className="w-full text-left text-sm"
            style={{ minWidth }}
          >
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {leadingHeader ? (
                  <th scope="col" className="px-3 py-3">
                    <div className="flex min-h-11 min-w-11 items-center">{leadingHeader}</div>
                  </th>
                ) : null}
                {columns.map((column) => (
                  <th key={column.id} scope="col" className={`px-3 py-3 ${column.headerClassName ?? ""}`.trim()}>
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        aria-label={`Sort by ${typeof column.header === "string" ? column.header : column.id}`}
                        aria-sort={toSortAriaSort(sortKey === column.id, sortDirection)}
                        onClick={() => onSortChange(column.id)}
                        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                      >
                        {column.header}
                        <SortIndicator active={sortKey === column.id} direction={sortDirection} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
                {hasActions ? (
                  <th scope="col" className="px-3 py-3">
                    {actionsHeader}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (leadingHeader ? 1 : 0) + (hasActions ? 1 : 0)}>
                    <div className="px-4 py-6">{emptyContent}</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const rowLabel = onRowClick && getRowLabel ? getRowLabel(row) : undefined;

                  return (
                  <tr
                    key={getRowId(row)}
                    aria-label={rowLabel}
                    className={`align-top hover:bg-slate-50/70 ${rowClassName?.(row) ?? ""}`.trim()}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                  >
                    {renderLeadingCell ? (
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        <div className="flex min-h-11 min-w-11 items-center">{renderLeadingCell(row)}</div>
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.id} className={`px-3 py-3 ${column.className ?? ""}`.trim()}>
                        {column.cell(row)}
                      </td>
                    ))}
                    {renderActions ? (
                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        {renderActions(row)}
                      </td>
                    ) : null}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="overflow-visible md:hidden">
        {rows.length === 0 ? (
          <div className="p-4">{emptyContent}</div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {rows.map((row) => {
              const rowLabel = onRowClick && getRowLabel ? getRowLabel(row) : undefined;

              return (
              <li key={getRowId(row)} className="overflow-visible">
                <div
                  aria-label={rowLabel}
                  className={`space-y-3 overflow-visible p-4 ${onRowClick ? "cursor-pointer" : ""} ${rowClassName?.(row) ?? ""}`.trim()}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {renderLeadingCell ? (
                    <div className="flex min-h-11 items-center" onClick={(event) => event.stopPropagation()}>
                      {renderLeadingCell(row)}
                    </div>
                  ) : null}
                  <dl className="space-y-2">
                    {visibleMobileColumns.map((column) => (
                      <div key={column.id} className="grid min-w-0 grid-cols-[minmax(0,34%)_1fr] gap-3 text-sm">
                        <dt className="font-medium text-slate-500">
                          {column.mobileLabel ??
                            (typeof column.header === "string" ? column.header : column.id)}
                        </dt>
                        <dd className="min-w-0 break-words text-slate-800">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                  {renderActions ? (
                    <div
                      className="flex w-full flex-wrap gap-2 overflow-visible"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {renderActions(row)}
                    </div>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagination ? <DataTablePaginationBar {...pagination} /> : null}
    </div>
  );
}
