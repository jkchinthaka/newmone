"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isDatabaseUnavailableError } from "@/lib/api-client";
import { backgroundPollingOptions, totalPagesFor } from "@/lib/list-query-state";
import { withTenantScope } from "@/lib/tenant-query";
import { userScopedStorageKey } from "@/lib/user-scoped-storage";

import {
  assignWorkOrder,
  approveWorkOrder,
  bulkDeleteWorkOrders,
  bulkUpdateStatus,
  createWorkOrder,
  deleteWorkOrder,
  fetchTechnicians,
  fetchWorkOrderById,
  fetchWorkOrdersPaginated,
  rejectWorkOrder,
  updateWorkOrder,
  updateWorkOrderStatus
} from "./api";
import {
  getTechnicianName,
  groupWorkOrdersByBoardTab,
  groupWorkOrdersByStatus
} from "./helpers";
import {
  DEFAULT_WORK_ORDER_FILTERS,
  type CreateWorkOrderInput,
  type TechnicianOption,
  type UpdateWorkOrderInput,
  type UpdateWorkOrderStatusInput,
  type WorkOrder,
  type WorkOrderFilters,
  type WorkOrderStatus
} from "./types";

const FILTER_STORAGE_KEY = "maintainpro_work_order_filters_v1";
export const WORK_ORDERS_QUERY_KEY = ["work-orders"] as const;
export const DASHBOARD_WORK_ORDERS_QUERY_KEY = ["dashboard", "work-orders"] as const;
export const WORK_ORDER_TECHNICIANS_QUERY_KEY = ["work-orders", "technicians"] as const;

type StatusGroups = Record<WorkOrderStatus, WorkOrder[]>;

function readStoredFilters(): WorkOrderFilters {
  if (typeof window === "undefined") {
    return DEFAULT_WORK_ORDER_FILTERS;
  }

  try {
    const raw = window.localStorage.getItem(userScopedStorageKey(FILTER_STORAGE_KEY));
    if (!raw) {
      return DEFAULT_WORK_ORDER_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<WorkOrderFilters>;
    // The job category belongs to the page (All / Machinery / Service / Vehicle Jobs), never to the
    // saved filters; otherwise All Jobs keeps showing only the last category page's jobs.
    const { jobDomain: _pageOwned, ...saved } = parsed;
    void _pageOwned;
    return {
      ...DEFAULT_WORK_ORDER_FILTERS,
      ...saved,
      page: 1
    };
  } catch {
    return DEFAULT_WORK_ORDER_FILTERS;
  }
}

export function useWorkOrderFilters() {
  const [filters, setFilters] = useState<WorkOrderFilters>(DEFAULT_WORK_ORDER_FILTERS);

  useEffect(() => {
    setFilters(readStoredFilters());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      // Page lives in the URL (?listPage=), not in saved filters.
      const { jobDomain: _pageOwned, ...saved } = filters;
      void _pageOwned;
      window.localStorage.setItem(userScopedStorageKey(FILTER_STORAGE_KEY), JSON.stringify({ ...saved, page: 1 }));
    } catch {
      // Storage can be unavailable (private mode); filters still work for this visit.
    }
  }, [filters]);

  const updateFilters = useCallback((patch: Partial<WorkOrderFilters>) => {
    setFilters((current) => ({
      ...current,
      ...patch
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_WORK_ORDER_FILTERS);
  }, []);

  return {
    filters,
    updateFilters,
    resetFilters,
    setFilters
  };
}

/** Server request for the List/Board views. Technician and every other filter are applied by the API. */
export function workOrderListRequest(filters: WorkOrderFilters) {
  return {
    page: filters.page,
    pageSize: filters.pageSize,
    queue: filters.queue,
    search: filters.query,
    status: filters.status,
    priority: filters.priority,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    dueDateFrom: filters.dueDateFrom,
    dueDateTo: filters.dueDateTo,
    jobDomain: filters.jobDomain,
    technicianId: filters.technicianId
  };
}

/**
 * "Completed" card: server total for the same filters with status COMPLETED.
 * Returns a number without a request when the status filter already decides it.
 */
export function completedCountSource(
  filters: Pick<WorkOrderFilters, "status">,
  total: number | undefined
): { kind: "known"; value: number } | { kind: "fetch" } {
  if (filters.status === "COMPLETED") return { kind: "known", value: total ?? 0 };
  if (filters.status !== "ALL") return { kind: "known", value: 0 };
  return { kind: "fetch" };
}

const LIST_POLL_MS = 60_000;

function groupByStatus(rows: WorkOrder[]): StatusGroups {
  return groupWorkOrdersByStatus(rows);
}

export function useWorkOrders(filters: WorkOrderFilters, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const request = useMemo(() => workOrderListRequest(filters), [filters]);
  const query = useQuery({
    queryKey: withTenantScope([...WORK_ORDERS_QUERY_KEY, "paginated", request]),
    queryFn: () => fetchWorkOrdersPaginated(request),
    enabled,
    retry: (failureCount, error) => {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    // Keep the previous page on screen while the next page/filter loads.
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    ...backgroundPollingOptions(LIST_POLL_MS)
  });

  const completedSource = completedCountSource(filters, query.data?.total);
  const completedRequest = useMemo(
    () => ({ ...request, status: "COMPLETED", page: 1, pageSize: 1 }),
    [request]
  );
  const completedQuery = useQuery({
    queryKey: withTenantScope([...WORK_ORDERS_QUERY_KEY, "completed-count", completedRequest]),
    queryFn: () => fetchWorkOrdersPaginated(completedRequest),
    enabled: enabled && completedSource.kind === "fetch",
    select: (data) => data.total,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false
  });

  const workOrders = useMemo(() => query.data?.data ?? [], [query.data?.data]);

  const groupedByStatus = useMemo(() => groupByStatus(workOrders), [workOrders]);
  const groupedByBoardTab = useMemo(() => groupWorkOrdersByBoardTab(workOrders), [workOrders]);

  const completedValue = completedSource.kind === "known" ? completedSource.value : completedQuery.data;
  const stats = useMemo(() => {
    const summary = query.data?.summary;
    return {
      total: summary?.total ?? query.data?.total ?? 0,
      open: summary?.open ?? 0,
      inProgress: summary?.inProgress ?? 0,
      overdue: summary?.overdue ?? 0,
      completed: completedValue ?? 0
    };
  }, [query.data?.summary, query.data?.total, completedValue]);

  const total = query.data?.total ?? 0;
  const pageSize = query.data?.pageSize || filters.pageSize;
  const pagination = useMemo(
    () => ({
      page: filters.page,
      pageSize,
      total,
      totalPages: totalPagesFor(total, pageSize)
    }),
    [filters.page, pageSize, total]
  );

  return {
    ...query,
    sourceRows: workOrders,
    workOrders,
    groupedByStatus,
    groupedByBoardTab,
    stats,
    pagination
  };
}

export function useWorkOrder(id: string | null) {
  return useQuery({
    queryKey: withTenantScope([...WORK_ORDERS_QUERY_KEY, "detail", id]),
    queryFn: () => fetchWorkOrderById(id as string),
    enabled: Boolean(id),
    retry: (failureCount, error) => {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    }
  });
}

export function useTechnicians(rows: WorkOrder[], enabled = true) {
  return useQuery({
    queryKey: withTenantScope(WORK_ORDER_TECHNICIANS_QUERY_KEY),
    queryFn: fetchTechnicians,
    enabled,
    staleTime: 5 * 60 * 1000,
    select: (apiRows): TechnicianOption[] => {
      const map = new Map<string, TechnicianOption>();

      apiRows.forEach((entry) => {
        map.set(entry.id, entry);
      });

      rows.forEach((order) => {
        if (order.technicianId && !map.has(order.technicianId)) {
          map.set(order.technicianId, {
            id: order.technicianId,
            fullName: getTechnicianName(order),
            roleName: order.technician?.role?.name
          });
        }
      });

      return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateWorkOrderInput) => createWorkOrder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkOrderInput }) => updateWorkOrder(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useDeleteWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useAssignWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, technicianId, reason, expectedVersion }: { id: string; technicianId: string; reason?: string; expectedVersion?: number }) =>
      assignWorkOrder(id, technicianId, { reason, expectedVersion }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: WORK_ORDER_TECHNICIANS_QUERY_KEY });
    }
  });
}

function mergeWorkOrderRow(existing: WorkOrder, updated: WorkOrder): WorkOrder {
  return {
    ...existing,
    ...updated,
    asset: updated.asset ?? existing.asset,
    vehicle: updated.vehicle ?? existing.vehicle,
    technician: updated.technician ?? existing.technician,
    createdBy: updated.createdBy ?? existing.createdBy
  };
}

function invalidateWorkOrderQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["work-orders", "queue"] });
  queryClient.invalidateQueries({ queryKey: ["work-orders", "queue-summary"] });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_WORK_ORDERS_QUERY_KEY });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateWorkOrderStatusInput }) => updateWorkOrderStatus(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
      const previous = queryClient.getQueryData<WorkOrder[]>(WORK_ORDERS_QUERY_KEY);

      queryClient.setQueryData<WorkOrder[]>(WORK_ORDERS_QUERY_KEY, (current = []) =>
        current.map((row) => {
          if (row.id !== id) {
            return row;
          }

          return {
            ...row,
            status: payload.status,
            actualCost: payload.actualCost ?? row.actualCost,
            actualHours: payload.actualHours ?? row.actualHours,
            completedDate: payload.status === "COMPLETED" ? new Date().toISOString() : row.completedDate
          };
        })
      );

      return { previous };
    },
    onSuccess: (updated, { id }) => {
      queryClient.setQueryData<WorkOrder[]>(WORK_ORDERS_QUERY_KEY, (current = []) =>
        current.map((row) => (row.id === id ? mergeWorkOrderRow(row, updated) : row))
      );
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WORK_ORDERS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      invalidateWorkOrderQueries(queryClient);
    }
  });
}

export function useBulkDeleteWorkOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteWorkOrders(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useBulkUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      items: Array<{ id: string; expectedVersion: number }>;
      status: WorkOrderStatus;
      payload?: { cancelReason?: string };
    }) => bulkUpdateStatus(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useApproveWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => approveWorkOrder(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}

export function useRejectWorkOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectWorkOrder(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORK_ORDERS_QUERY_KEY });
    }
  });
}
