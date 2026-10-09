"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { AlertTriangle, ChevronDown, Loader2 } from "lucide-react";

import { ActiveFilterChips } from "@/components/operational/active-filter-chips";
import { JobsPagination } from "@/components/operational/jobs-pagination";
import { OperationalEmptyState, TableLoadingRows } from "@/components/operational/operational-list-states";
import { QueueTabBar } from "@/components/operational/queue-tab-bar";
import { withLockedJobDomain } from "@/lib/domain-jobs-columns";
import { ErrorState } from "@/components/ui/page-state";
import { getApiErrorMessage, isDatabaseUnavailableError } from "@/lib/api-client";
import { JOB_DOMAINS, JOB_DOMAIN_LABELS } from "@/lib/job-domain";
import {
  activeQueueFilterChips,
  queueFiltersAfterChipRemove,
  splitQueueTabs,
  writeQueueFiltersToSearch
} from "@/lib/work-order-queue-nav";
import { withTenantScope } from "@/lib/tenant-query";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  DEFAULT_QUEUE_FILTERS,
  FALLBACK_QUEUE_SUMMARY,
  fetchSmartViews,
  fetchWorkOrderQueue,
  fetchWorkOrderQueueSummary,
  queueFiltersFromSearch,
  workOrderQueueRequestKey,
  type WorkOrderQueueFilters,
  type WorkOrderQueueItem,
  type WorkOrderQueueKey,
  type WorkOrderQueueSummary
} from "@/lib/work-order-queues-api";

import { WorkOrderCompactTable } from "./work-order-compact-table";
import { WorkOrderMobileCardList } from "./work-order-mobile-card-list";
import { humanWorkOrderStatusLabel } from "./helpers";
import { WORK_ORDER_STATUSES, type TechnicianOption, type WorkOrder } from "./types";

type Props = {
  onOpenWorkOrder: (workOrder: WorkOrder) => void;
  onRefreshLegacy?: () => void;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  jobDomain?: string;
  technicians?: TechnicianOption[];
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

const fieldClass =
  "h-10 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

export function WorkOrderQueuePanel({
  onOpenWorkOrder,
  onRefreshLegacy,
  selectedIds = [],
  onSelectedIdsChange,
  jobDomain,
  technicians = []
}: Props) {
  const currentUser = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQueue = searchParams.get("queue");
  const urlSmartView = searchParams.get("smartView");
  const urlStatus = searchParams.get("status");
  const urlPriority = searchParams.get("priority");
  const urlUnassigned = searchParams.get("unassigned");
  const urlFilter = searchParams.get("filter");
  const urlQuery = searchParams.get("q") ?? searchParams.get("search");
  const linkedFilters = useMemo(
    () =>
      queueFiltersFromSearch({
        queue: urlQueue,
        smartView: urlSmartView,
        status: urlStatus,
        priority: urlPriority,
        unassigned: urlUnassigned,
        filter: urlFilter,
        q: urlQuery,
        overdueOnly: searchParams.get("overdueOnly"),
        highRiskOnly: searchParams.get("highRiskOnly"),
        triageOnly: searchParams.get("triageOnly"),
        dateFrom: searchParams.get("dateFrom"),
        dateTo: searchParams.get("dateTo"),
        categoryId: searchParams.get("categoryId"),
        technicianId: searchParams.get("technicianId"),
        evidenceStatus: searchParams.get("evidenceStatus"),
        partsStatus: searchParams.get("partsStatus"),
        jobDomain: searchParams.get("jobDomain"),
        page: searchParams.get("page"),
        pageSize: searchParams.get("pageSize")
      }),
    [urlQueue, urlSmartView, urlStatus, urlPriority, urlUnassigned, urlFilter, urlQuery, searchParams]
  );
  const [filters, setFilters] = useState<WorkOrderQueueFilters>(DEFAULT_QUEUE_FILTERS);
  const [searchInput, setSearchInput] = useState(urlQuery ?? "");
  const [initialized, setInitialized] = useState(false);
  const [moreQueuesOpen, setMoreQueuesOpen] = useState(false);

  const canBulkSelect = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "SUPERVISOR"].includes(
    currentUser?.role ?? ""
  );

  const appliedSearch = useRef(searchInput);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (appliedSearch.current === searchInput) return;
      appliedSearch.current = searchInput;
      onSelectedIdsChange?.([]);
      setFilters((current) =>
        current.query === searchInput ? current : { ...current, query: searchInput, page: 1 }
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, onSelectedIdsChange]);

  const smartViewsQuery = useQuery({
    queryKey: withTenantScope(["work-orders", "smart-views"]),
    queryFn: fetchSmartViews,
    staleTime: 5 * 60_000
  });

  const summaryQuery = useQuery({
    queryKey: withTenantScope(["work-orders", "queue-summary", jobDomain ?? ""]),
    queryFn: () => fetchWorkOrderQueueSummary(jobDomain),
    retry: shouldRetryQueueRequest,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => (query.state.error ? false : 30_000)
  });

  const summaryData: WorkOrderQueueSummary = summaryQuery.data ?? FALLBACK_QUEUE_SUMMARY;
  const summaryUnavailable = summaryQuery.isError && !summaryQuery.data;

  useEffect(() => {
    if ((summaryQuery.data || summaryUnavailable) && !initialized) {
      setInitialized(true);
      setFilters((current) => ({
        ...current,
        ...linkedFilters,
        queue:
          linkedFilters.queue ??
          summaryQuery.data?.defaultQueue ??
          FALLBACK_QUEUE_SUMMARY.defaultQueue,
        query: urlQuery ?? current.query,
        jobDomain: jobDomain || undefined
      }));
      if (urlQuery) {
        setSearchInput(urlQuery);
      }
    }
  }, [summaryQuery.data, summaryUnavailable, initialized, linkedFilters, urlQuery]);

  useEffect(() => {
    if (!initialized || !linkedFilters.queue) {
      return;
    }
    setSearchInput(linkedFilters.query ?? "");
    setFilters((current) => {
      const next = {
        ...current,
        ...linkedFilters,
        queue: linkedFilters.queue ?? current.queue,
        status: linkedFilters.status ?? "ALL",
        priority: linkedFilters.priority ?? "ALL",
        unassigned: Boolean(linkedFilters.unassigned),
        query: linkedFilters.query ?? "",
        overdueOnly: Boolean(linkedFilters.overdueOnly),
        highRiskOnly: Boolean(linkedFilters.highRiskOnly),
        triageOnly: Boolean(linkedFilters.triageOnly),
        dateFrom: linkedFilters.dateFrom ?? "",
        dateTo: linkedFilters.dateTo ?? "",
        categoryId: linkedFilters.categoryId ?? "",
        technicianId: linkedFilters.technicianId ?? "",
        evidenceStatus: linkedFilters.evidenceStatus ?? "",
        partsStatus: linkedFilters.partsStatus ?? "",
        smartView: linkedFilters.smartView,
        jobDomain: jobDomain || linkedFilters.jobDomain || undefined,
        page: linkedFilters.page ?? 1,
        pageSize: linkedFilters.pageSize ?? current.pageSize
      };
      const same =
        current.queue === next.queue &&
        current.status === next.status &&
        current.priority === next.priority &&
        current.query === next.query &&
        current.page === next.page &&
        current.pageSize === next.pageSize &&
        current.smartView === next.smartView &&
        Boolean(current.unassigned) === Boolean(next.unassigned) &&
        current.overdueOnly === next.overdueOnly &&
        current.highRiskOnly === next.highRiskOnly &&
        current.triageOnly === next.triageOnly &&
        current.dateFrom === next.dateFrom &&
        current.dateTo === next.dateTo &&
        current.categoryId === next.categoryId &&
        (current.technicianId ?? "") === (next.technicianId ?? "") &&
        (current.evidenceStatus ?? "") === (next.evidenceStatus ?? "") &&
        (current.partsStatus ?? "") === (next.partsStatus ?? "") &&
        (current.jobDomain ?? "") === (next.jobDomain ?? "");
      return same ? current : next;
    });
  }, [initialized, linkedFilters, jobDomain]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(searchParams.toString());
    writeQueueFiltersToSearch(params, { ...filters, jobDomain: jobDomain || filters.jobDomain });
    const next = params.toString();
    if (next !== searchParams.toString()) {
      router.replace((next ? `${pathname}?${next}` : pathname) as Route, { scroll: false });
    }
  }, [filters, initialized, jobDomain, pathname, router, searchParams]);

  const roleName = extractRoleName(currentUser);
  const isTechnician = roleName === "TECHNICIAN" || roleName === "MECHANIC";
  const listFilters = isTechnician && filters.queue === "all" ? { ...filters, queue: "my-tasks" as const } : filters;

  const queueQuery = useQuery({
    queryKey: withTenantScope(["work-orders", "queue", workOrderQueueRequestKey(listFilters)]),
    queryFn: () => fetchWorkOrderQueue(listFilters),
    enabled: initialized,
    retry: shouldRetryQueueRequest,
    refetchOnWindowFocus: true,
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

  // Smart views are query-string shortcuts into the same queues the tabs above already
  // navigate to. A smart view is a true duplicate of a tab only when its own key names
  // the same queue (e.g. smart view "overdue" -> queue "overdue"): those apply no extra
  // narrowing beyond what clicking the tab already does. Several others share a
  // *queueKey* with a tab but are NOT duplicates — "Completed This Month" / "Cancelled
  // This Month" add a this-month date window on top of the Completed/Cancelled queue,
  // and "Created Today" / "Updated Today" narrow "All" to today — so this compares
  // view.key (the smart view's own identity), never view.queueKey, against the tab
  // keys. Getting this backwards would silently hide the date-scoped views entirely,
  // not just their button.
  const distinctSmartViews = useMemo(() => {
    const tabKeys = new Set(visibleQueues.map((queue) => queue.key as string));
    return (smartViewsQuery.data?.views ?? []).filter((view) => !tabKeys.has(view.key));
  }, [smartViewsQuery.data?.views, visibleQueues]);
  const queueTabs = useMemo(() => splitQueueTabs(visibleQueues), [visibleQueues]);

  const rows = queueQuery.data?.data ?? [];

  const actionRequiredCount =
    summaryData.queues?.find((queue) => queue.key === "action-required")?.count ?? 0;

  const totalPages = Math.max(1, Math.ceil((queueQuery.data?.total ?? 0) / filters.pageSize));

  const updateFilters = (patch: Partial<WorkOrderQueueFilters>) => {
    if (patch.query !== undefined) {
      setSearchInput(patch.query);
    }
    if (Object.keys(patch).some((key) => key !== "page")) {
      onSelectedIdsChange?.([]);
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

  const clearFilters = () => {
    updateFilters(
      withLockedJobDomain(
        {
          query: "",
          status: "ALL",
          priority: "ALL",
          overdueOnly: false,
          highRiskOnly: false,
          triageOnly: false,
          dateFrom: "",
          dateTo: "",
          categoryId: "",
          technicianId: "",
          evidenceStatus: "",
          partsStatus: "",
          smartView: undefined,
          unassigned: false,
          page: 1
        },
        jobDomain
      )
    );
  };

  const chips = activeQueueFilterChips(filters).filter((chip) => !(jobDomain && chip.key === "jobDomain"));
  const summaryBits = [
    summaryData.summary?.supervisorVerification ? "Verification" : "",
    summaryData.summary?.waitingEvidence ? "Evidence" : "",
    summaryData.summary?.waitingParts ? "Parts" : "",
    summaryData.summary?.highRisk ? "Risk" : ""
  ].filter(Boolean);
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
        <button
          type="button"
          onClick={() => updateFilters({ queue: "action-required", smartView: undefined, page: 1 })}
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-left text-sm text-amber-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          aria-label={`${actionRequiredCount} work orders need action. View the action required queue.`}
        >
          <AlertTriangle size={16} className="shrink-0 text-amber-700" aria-hidden />
          <span className="font-semibold">{actionRequiredCount} need action</span>
          {summaryBits.length ? <span className="text-amber-900">{summaryBits.join(" · ")}</span> : null}
          <span className="ml-auto font-medium text-amber-900">View</span>
        </button>
      ) : null}

      <div className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <QueueTabBar
          label="Work order queues"
          primary={queueTabs.primary}
          more={queueTabs.more}
          selectedKey={filters.queue}
          moreOpen={moreQueuesOpen}
          onMoreOpenChange={setMoreQueuesOpen}
          onSelect={(key) => updateFilters({ queue: key as WorkOrderQueueKey, smartView: undefined, page: 1 })}
        />

        <div className="flex flex-col gap-2 border-b border-slate-200 px-3 py-2 lg:flex-row lg:items-center">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Search work orders</span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search work orders..."
              className={`${fieldClass} w-full`}
            />
          </label>
          <label className="min-w-[9rem]">
            <span className="sr-only">Status</span>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value as WorkOrderQueueFilters["status"], page: 1 })}
              className={`${fieldClass} w-full`}
            >
              <option value="ALL">All statuses</option>
              {WORK_ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanWorkOrderStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[8rem]">
            <span className="sr-only">Priority</span>
            <select
              value={filters.priority}
              onChange={(event) => updateFilters({ priority: event.target.value as WorkOrderQueueFilters["priority"], page: 1 })}
              className={`${fieldClass} w-full`}
            >
              <option value="ALL">All priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label className="min-w-[9rem]">
            <span className="sr-only">Assignee</span>
            <select
              value={filters.technicianId || ""}
              onChange={(event) => updateFilters({ technicianId: event.target.value, page: 1 })}
              className={`${fieldClass} w-full`}
            >
              <option value="">All assignees</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.fullName}
                </option>
              ))}
            </select>
          </label>
          {jobDomain ? null : (
            <label className="min-w-[8rem]">
              <span className="sr-only">Domain</span>
              <select
                value={filters.jobDomain || ""}
                onChange={(event) => updateFilters({ jobDomain: event.target.value || undefined, page: 1 })}
                className={`${fieldClass} w-full`}
              >
                <option value="">All domains</option>
                {JOB_DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>
                    {JOB_DOMAIN_LABELS[domain]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {distinctSmartViews.length ? (
            <label className="min-w-[10rem]">
              <span className="sr-only">Saved views</span>
              <select
                value={filters.smartView || ""}
                onChange={(event) => {
                  const view = distinctSmartViews.find((item) => item.key === event.target.value);
                  updateFilters({
                    smartView: view?.key,
                    queue: view?.queueKey ?? filters.queue,
                    page: 1
                  });
                }}
                className={`${fieldClass} w-full`}
              >
                <option value="">Saved views</option>
                {distinctSmartViews.map((view) => (
                  <option key={view.key} value={view.key}>
                    {view.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <details className="relative">
            <summary className={`${fieldClass} flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden`}>
              More filters
              <ChevronDown size={14} aria-hidden />
            </summary>
            <div className="mt-2 w-full space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid sm:grid-cols-2 sm:gap-3 sm:space-y-0 lg:grid-cols-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.overdueOnly} onChange={(event) => updateFilters({ overdueOnly: event.target.checked, page: 1 })} />
                Overdue only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.highRiskOnly} onChange={(event) => updateFilters({ highRiskOnly: event.target.checked, page: 1 })} />
                High risk only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.triageOnly} onChange={(event) => updateFilters({ triageOnly: event.target.checked, page: 1 })} />
                Triage only
              </label>
              <label className="block text-sm">
                Evidence
                <select
                  value={filters.evidenceStatus || ""}
                  onChange={(event) => updateFilters({ evidenceStatus: event.target.value, page: 1 })}
                  className={`${fieldClass} mt-1 w-full`}
                >
                  <option value="">Any evidence</option>
                  <option value="Missing">Missing</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Complete">Complete</option>
                </select>
              </label>
              <label className="block text-sm">
                Parts
                <select
                  value={filters.partsStatus || ""}
                  onChange={(event) => updateFilters({ partsStatus: event.target.value, page: 1 })}
                  className={`${fieldClass} mt-1 w-full`}
                >
                  <option value="">Any parts</option>
                  <option value="Waiting issue">Waiting issue</option>
                  <option value="Approval pending">Approval pending</option>
                  <option value="Pending return">Pending return</option>
                  <option value="Issued">Issued</option>
                </select>
              </label>
              <label className="block text-sm">
                Created from
                <input type="date" value={filters.dateFrom} onChange={(event) => updateFilters({ dateFrom: event.target.value, page: 1 })} className={`${fieldClass} mt-1 w-full`} />
              </label>
              <label className="block text-sm">
                Created to
                <input type="date" value={filters.dateTo} onChange={(event) => updateFilters({ dateTo: event.target.value, page: 1 })} className={`${fieldClass} mt-1 w-full`} />
              </label>
              {queueQuery.data?.categorySummary?.length ? (
                <label className="block text-sm">
                  Category
                  <select
                    value={filters.categoryId}
                    onChange={(event) => updateFilters({ categoryId: event.target.value, page: 1 })}
                    className={`${fieldClass} mt-1 w-full`}
                  >
                    <option value="">All categories</option>
                    {queueQuery.data.categorySummary.slice(0, 12).map((row) => (
                      <option key={row.categoryId ?? row.categoryName} value={row.categoryId ?? ""}>
                        {row.categoryName} ({row.total})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </details>
          {chips.length ? (
            <button type="button" onClick={clearFilters} className="h-10 px-2 text-sm font-medium text-slate-700 hover:text-slate-900">
              Clear
            </button>
          ) : null}
        </div>
        <ActiveFilterChips
          chips={chips}
          onRemove={(key) => updateFilters(withLockedJobDomain(queueFiltersAfterChipRemove(key), jobDomain))}
          onClearAll={clearFilters}
        />

        {queueQuery.isLoading ? (
          <TableLoadingRows />
        ) : queueQuery.isError ? (
          <div className="p-6">
            <ErrorState
              title="Unable to load work orders"
              description={getApiErrorMessage(queueQuery.error, "Please check backend connection.")}
              onRetry={() => void queueQuery.refetch()}
            />
          </div>
        ) : rows.length === 0 ? (
          <OperationalEmptyState
            onClear={clearFilters}
            onViewAll={
              visibleQueues.some((queue) => queue.key === "all") || summaryData.defaultQueue
                ? () =>
              updateFilters({
                queue:
                  (visibleQueues.some((queue) => queue.key === "all") ? "all" : summaryData.defaultQueue) as WorkOrderQueueKey,
                query: "",
                status: "ALL",
                priority: "ALL",
                overdueOnly: false,
                highRiskOnly: false,
                triageOnly: false,
                dateFrom: "",
                dateTo: "",
                categoryId: "",
                technicianId: "",
                evidenceStatus: "",
                partsStatus: "",
                smartView: undefined,
                unassigned: false,
                jobDomain: jobDomain || undefined,
                page: 1
              })
                : undefined
            }
          />
        ) : (
          <>
            <WorkOrderCompactTable
              rows={rows}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onOpen={(row) => onOpenWorkOrder(row)}
              canBulkSelect={canBulkSelect}
              jobDomain={jobDomain}
            />
            <WorkOrderMobileCardList rows={rows} onOpen={(row) => onOpenWorkOrder(row)} jobDomain={jobDomain} />
          </>
        )}

        <JobsPagination
          page={filters.page}
          totalPages={totalPages}
          total={queueQuery.data?.total ?? 0}
          pageSize={filters.pageSize}
          onPageChange={(page) => updateFilters({ page })}
          onPageSizeChange={(pageSize) => updateFilters({ pageSize, page: 1 })}
        />
      </div>
    </div>
  );
}
