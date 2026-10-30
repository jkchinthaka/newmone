"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { JobsPagination } from "@/components/operational";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { RefreshingNote, TableLoadingRows } from "@/components/ui/loading";
import { ErrorState } from "@/components/ui/page-state";
import { apiClient } from "@/lib/api-client";
import {
  compactRegisterFilters,
  parseRegisterPage,
  REGISTER_DEFAULT_PAGE_SIZE,
  type RegisterPage
} from "@/lib/fleet-register";

/** Sticky table header inside a bounded scroll area (desktop table of DataTable). */
export const STICKY_TABLE_CLASS =
  "[&_.overflow-x-auto]:max-h-[70vh] [&_.overflow-x-auto]:overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10";

/**
 * One page of a fleet register. Keeps the previous page on screen while the next one loads,
 * and resets to page 1 when a filter changes.
 */
export function useRegisterPage<T>(path: string, filters: Record<string, string | null | undefined>) {
  const params = useMemo(() => compactRegisterFilters(filters), [filters]);
  const filterKey = JSON.stringify(params);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(REGISTER_DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const query = useQuery<RegisterPage<T>>({
    queryKey: ["fleet-register", path, params, page, pageSize],
    queryFn: async ({ signal }) => {
      const response = await apiClient.get(path, { signal, params: { ...params, page, pageSize } });
      return parseRegisterPage<T>(response.data, page, pageSize);
    },
    placeholderData: keepPreviousData
  });

  return {
    query,
    page,
    pageSize,
    setPage,
    setPageSize: (next: number) => {
      setPageSize(next);
      setPage(1);
    }
  };
}

type RegisterListProps<T> = {
  register: ReturnType<typeof useRegisterPage<T>>;
  columns: readonly DataTableColumn<T>[];
  getRowId: (row: T) => string;
  getRowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  ariaLabel: string;
  emptyTitle: string;
  emptyDescription?: string;
  errorTitle: string;
  minWidth?: string;
  toolbar?: ReactNode;
};

/**
 * Loading -> skeleton rows; failed load -> ErrorState with Retry (never an empty/zero list);
 * otherwise DataTable (desktop table + mobile cards) with the shared pager.
 */
export function RegisterList<T>({
  register,
  columns,
  getRowId,
  getRowLabel,
  onRowClick,
  ariaLabel,
  emptyTitle,
  emptyDescription,
  errorTitle,
  minWidth = "880px",
  toolbar
}: RegisterListProps<T>) {
  const { query, page, pageSize, setPage, setPageSize } = register;
  const data = query.data;

  if (!data) {
    if (query.isError) {
      return <ErrorState title={errorTitle} error={query.error} onRetry={() => void query.refetch()} />;
    }
    return (
      <section className="rounded-xl border border-slate-200 bg-white">
        <TableLoadingRows label={`Loading ${ariaLabel.toLowerCase()}`} />
      </section>
    );
  }

  return (
    <div className="space-y-2">
      {query.isError ? (
        <ErrorState title={errorTitle} error={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {toolbar || query.isFetching ? (
        <div className="flex min-h-6 flex-wrap items-center justify-between gap-2">
          {toolbar ?? <span />}
          {query.isFetching && !query.isError ? <RefreshingNote /> : null}
        </div>
      ) : null}
      {query.isError ? null : (
        <>
          <DataTable
            rows={data.rows}
            columns={columns}
            getRowId={getRowId}
            getRowLabel={getRowLabel}
            onRowClick={onRowClick}
            ariaLabel={ariaLabel}
            emptyTitle={emptyTitle}
            emptyDescription={emptyDescription}
            minWidth={minWidth}
            className={STICKY_TABLE_CLASS}
          />
          {data.total > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white">
              <JobsPagination
                page={page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * The record a `?id=` deep link points at: taken from the loaded page when present,
 * otherwise fetched from `${path}/${id}` (links from the fleet workspace can point past page 1).
 */
export function useRegisterRecord<T extends { id: string }>(path: string, id: string | null, rows: readonly T[] | undefined) {
  const fromPage = id ? rows?.find((row) => row.id === id) : undefined;
  const query = useQuery<T>({
    queryKey: ["fleet-register", path, "record", id],
    enabled: Boolean(id) && !fromPage && rows !== undefined,
    queryFn: async ({ signal }) => {
      const response = await apiClient.get(`${path}/${encodeURIComponent(id ?? "")}`, { signal });
      return (response.data as { data: T }).data;
    }
  });
  return { record: fromPage ?? (id ? query.data : undefined), query };
}

/** Read and write the `?id=` record deep link without adding history entries. */
export function useRecordParam() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const setId = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("id", next);
    else params.delete("id");
    const query = params.toString();
    router.replace((query ? `${pathname}?${query}` : pathname) as never, { scroll: false });
  };
  return [id, setId] as const;
}
