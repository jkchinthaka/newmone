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
  fetchWorkOrderQueue,
  fetchWorkOrderQueueSummary,
  type WorkOrderQueueFilters,
  type WorkOrderQueueItem,
  type WorkOrderQueueKey,
  type WorkOrderQueueSummary
} from "@/lib/work-order-queues-api";

import { formatDate, getAssetLabel, getPriorityClass, getStatusClass, getTechnicianName, toTitleCase } from "./helpers";
import type { WorkOrder } from "./types";

type Props = {
  onOpenWorkOrder: (workOrder: WorkOrder) => void;
  onRefreshLegacy?: () => void;
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

export function WorkOrderQueuePanel({ onOpenWorkOrder, onRefreshLegacy }: Props) {
  const currentUser = useCurrentUser();
  const [filters, setFilters] = useState<WorkOrderQueueFilters>(DEFAULT_QUEUE_FILTERS);
  const [initialized, setInitialized] = useState(false);

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

  const rows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    const items = queueQuery.data?.data ?? [];
    if (!query) return items;
    return items.filter((item) =>
      [item.title, item.woNumber, getAssetLabel(item), getTechnicianName(item), item.primaryAssigneeName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [queueQuery.data?.data, filters.query]);

  const actionRequiredCount =
    summaryData.queues.find((queue) => queue.key === "action-required")?.count ?? 0;

  const totalPages = Math.max(1, Math.ceil((queueQuery.data?.total ?? 0) / filters.pageSize));

  const updateFilters = (patch: Partial<WorkOrderQueueFilters>) => {
    setFilters((current) => ({
      ...current,
      ...patch,
      page: patch.page ?? (patch.queue || patch.pageSize ? 1 : current.page)
    }));
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
            value={filters.query}
            onChange={(event) => updateFilters({ query: event.target.value, page: 1 })}
            placeholder="Search WO, title, asset..."
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
              ? "No work orders need your action."
              : "No work orders found for this queue."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Work Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Asset / Assignee</th>
                  <th className="px-4 py-3">Parts / Evidence</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3">Action Required</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <QueueRow key={row.id} row={row} onOpen={() => onOpenWorkOrder(row)} />
                ))}
              </tbody>
            </table>
          </div>
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

function QueueRow({ row, onOpen }: { row: WorkOrderQueueItem; onOpen: () => void }) {
  const primaryAction = row.actionRequired?.[0];
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-semibold text-brand-700">{row.woNumber}</p>
        <p className="font-medium text-slate-900">{row.title}</p>
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${getPriorityClass(row.priority)}`}>
          {toTitleCase(row.priority)}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${getStatusClass(row.status)}`}>
          {toTitleCase(row.status.replaceAll("_", " "))}
        </span>
        {row.verificationStatus && row.verificationStatus !== "NOT_REQUIRED" ? (
          <p className="mt-1 text-xs text-slate-500">Verification: {toTitleCase(row.verificationStatus)}</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${riskBadgeClass(row.riskSeverity)}`}>
          {row.riskScore ?? 0} · {row.riskSeverity ?? "LOW"}
        </span>
      </td>
      <td className="px-4 py-3">
        <p>{getAssetLabel(row)}</p>
        <p className="text-xs text-slate-500">{row.primaryAssigneeName ?? getTechnicianName(row)}</p>
      </td>
      <td className="px-4 py-3 text-xs text-slate-600">
        <p>Parts: {row.partsStatus ?? "None"}</p>
        <p>Evidence: {row.evidenceStatus ?? "—"}</p>
      </td>
      <td className="px-4 py-3">
        <p>{formatDate(row.dueDate)}</p>
        {row.overdueDays && row.overdueDays > 0 ? (
          <p className="text-xs font-medium text-red-700">Overdue {row.overdueDays}d</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        {primaryAction ? (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
            {primaryAction.label}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button type="button" onClick={onOpen} className="rounded-lg border border-brand-300 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-50">
          Open
        </button>
      </td>
    </tr>
  );
}
