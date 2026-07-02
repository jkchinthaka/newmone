"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage, isDatabaseUnavailableError } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  DEFAULT_QUEUE_FILTERS,
  FALLBACK_QUEUE_SUMMARY,
  fetchSmartViews,
  fetchWorkOrderQueue,
  fetchWorkOrderQueueSummary,
  type WorkOrderQueueFilters,
  type WorkOrderQueueItem,
  type WorkOrderQueueKey,
  type WorkOrderQueueSummary
} from "@/lib/work-order-queues-api";

import { WorkOrderCompactTable } from "./work-order-compact-table";
import { WorkOrderMobileCardList } from "./work-order-mobile-card-list";
import type { WorkOrder } from "./types";

type Props = {
  onOpenWorkOrder: (workOrder: WorkOrder) => void;
  onRefreshLegacy?: () => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
};

function shouldRetryQueueRequest(failureCount: number, error: unknown) {
  if (isDatabaseUnavailableError(error)) {
    return false;
  }
  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404 || status === 401 || status === 403 || status === 503) return false;
  }
  return failureCount < 1;
}

function riskBadgeClass(severity?: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-100 text-red-900 border-red-200";
    case "HIGH":
      return "bg-orange-100 text-orange-900 border-orange-200";
    case "MEDIUM":
      return "bg-amber-100 text-amber-900 border-amber-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function WorkOrderQueuePanel({
  onOpenWorkOrder,
  onRefreshLegacy,
  selectedIds = [],
  onSelectedIdsChange
}: Props) {
  const currentUser = useCurrentUser();
  const [filters, setFilters] = useState<WorkOrderQueueFilters>(DEFAULT_QUEUE_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [initialized, setInitialized] = useState(false);

  const canBulkSelect = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR"].includes(
    currentUser?.role ?? ""
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => ({
        ...current,
        query: searchInput,
        page: current.query === searchInput ? current.page : 1
      }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const smartViewsQuery = useQuery({
    queryKey: ["work-orders", "smart-views"],
    queryFn: fetchSmartViews,
    staleTime: 5 * 60_000
  });

  const summaryQuery = useQuery({
    queryKey: ["work-orders", "queue-summary"],
    queryFn: fetchWorkOrderQueueSummary,
    retry: shouldRetryQueueRequest,
    refetchInterval: (query) => (query.state.error ? false : 30_000)
  });

  const summaryData: WorkOrderQueueSummary = summaryQuery.data ?? FALLBACK_QUEUE_SUMMARY;
  const summaryUnavailable = summaryQuery.isError && !summaryQuery.data;

  useEffect(() => {
    if ((summaryQuery.data || summaryUnavailable) && !initialized) {
      setInitialized(true);
      setFilters((current) => ({
        ...current,
        queue: summaryQuery.data?.defaultQueue ?? FALLBACK_QUEUE_SUMMARY.defaultQueue
      }));
    }
  }, [summaryQuery.data, summaryUnavailable, initialized]);

  const queueQuery = useQuery({
    queryKey: ["work-orders", "queue", filters],
    queryFn: () => fetchWorkOrderQueue(filters),
    enabled: initialized,
    retry: shouldRetryQueueRequest,
    refetchInterval: (query) => (query.state.error ? false : 30_000)
  });

  const visibleQueues = useMemo(() => {
    const role = currentUser?.role ?? "";
    const isTechnician = role === "TECHNICIAN" || role === "MECHANIC";
    return (summaryData.queues ?? []).filter((queue) => {
      if (isTechnician && queue.key === "all") return false;
      return true;
    });
  }, [summaryData.queues, currentUser?.role]);

  const rows = queueQuery.data?.data ?? [];

  const actionRequiredCount =
    summaryData.queues.find((queue) => queue.key === "action-required")?.count ?? 0;

  const totalPages = Math.max(1, Math.ceil((queueQuery.data?.total ?? 0) / filters.pageSize));

  const updateFilters = (patch: Partial<WorkOrderQueueFilters>) => {
    if (patch.query !== undefined) {
      setSearchInput(patch.query);
    }
    setFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? (patch.queue || patch.pageSize || patch.smartView ? 1 : current.page)
    }));
  };

  const toggleSelect = (id: string) => {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id]);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (!onSelectedIdsChange) return;
    onSelectedIdsChange(checked ? rows.map((row) => row.id) : []);
  };

  if (summaryQuery.isLoading && !summaryQuery.data && !summaryUnavailable) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        <Loader2 size={16} className="animate-spin" /> Loading work order queues...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {summaryUnavailable ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Unable to load work order queues. Please refresh or contact IT. You can still browse queues below; counts may show as zero until the service recovers.
        </div>
      ) : null}
      {actionRequiredCount > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-950">{actionRequiredCount} work order(s) need action</p>
                <p className="text-sm text-amber-900">Approval, verification, evidence, parts, or risk items waiting.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateFilters({ queue: "action-required", page: 1 })}
              className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800"
            >
              View Action Required
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          No work orders need your action right now.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="flex min-w-max gap-1 border-b border-slate-200 px-2 py-2">
          {visibleQueues.map((queue) => {
            const selected = filters.queue === queue.key;
            return (
              <button
                key={queue.key}
                type="button"
                onClick={() => updateFilters({ queue: queue.key as WorkOrderQueueKey, page: 1 })}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  selected ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {queue.label}
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${selected ? "bg-white/20" : "bg-slate-200"}`}>
                  {queue.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 border-b border-slate-200 px-4 py-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <input
            value={searchInput}
            onChange={(event) => updateFilters({ query: event.target.value, page: 1 })}
            placeholder="Search WO, title, asset... (min 2 chars)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={filters.priority}
            onChange={(event) => updateFilters({ priority: event.target.value as WorkOrderQueueFilters["priority"], page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">All priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={filters.pageSize}
            onChange={(event) => updateFilters({ pageSize: Number(event.target.value), page: 1 })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(event) => updateFilters({ overdueOnly: event.target.checked, page: 1 })}
            />
            Overdue only
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.highRiskOnly}
              onChange={(event) => updateFilters({ highRiskOnly: event.target.checked, page: 1 })}
            />
            High risk only
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.triageOnly}
              onChange={(event) => updateFilters({ triageOnly: event.target.checked, page: 1 })}
            />
            Triage only
          </label>
          <button
            type="button"
            onClick={() => {
              void summaryQuery.refetch();
              void queueQuery.refetch();
              onRefreshLegacy?.();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {smartViewsQuery.data?.views?.length ? (
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Smart views</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {smartViewsQuery.data.views.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() =>
                    updateFilters({
                      smartView: view.key,
                      queue: view.queueKey,
                      page: 1
                    })
                  }
                  className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    filters.smartView === view.key
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {queueQuery.data?.categorySummary?.length ? (
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Category summary</p>
            <div className="flex flex-wrap gap-2">
              {queueQuery.data.categorySummary.slice(0, 8).map((row) => (
                <button
                  key={row.categoryId ?? row.categoryName}
                  type="button"
                  onClick={() =>
                    updateFilters({
                      categoryId: row.categoryId ?? "",
                      page: 1
                    })
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  <div className="font-semibold text-slate-900">{row.categoryName}</div>
                  <div className="text-slate-600">
                    {row.total} total · {row.open} open · {row.overdue} overdue
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {queueQuery.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" /> Loading queue...
          </div>
        ) : queueQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Unable to load work orders"
              description={getApiErrorMessage(queueQuery.error, "Please check backend connection.")}
              onRetry={() => void queueQuery.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            {filters.queue === "action-required"
              ? "No actions required right now."
              : filters.query.trim().length >= 2
                ? "No work orders match your filters."
                : "No work orders found for this queue."}
          </div>
        ) : (
          <>
            <WorkOrderCompactTable
              rows={rows}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onOpen={(row) => onOpenWorkOrder(row)}
              canBulkSelect={canBulkSelect}
            />
            <WorkOrderMobileCardList rows={rows} onOpen={(row) => onOpenWorkOrder(row)} />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <p className="text-sm text-slate-600">
            Showing page {filters.page} of {totalPages} · {queueQuery.data?.total ?? 0} total
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={filters.page <= 1}
              onClick={() => updateFilters({ page: filters.page - 1 })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              type="button"
              disabled={filters.page >= totalPages}
              onClick={() => updateFilters({ page: filters.page + 1 })}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
