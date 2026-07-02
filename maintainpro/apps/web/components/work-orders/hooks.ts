"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isDatabaseUnavailableError } from "@/lib/api-client";

import {
  assignWorkOrder,
  approveWorkOrder,
  bulkDeleteWorkOrders,
  bulkUpdateStatus,
  createWorkOrder,
  deleteWorkOrder,
  fetchTechnicians,
  fetchWorkOrdersPaginated,
  rejectWorkOrder,
  updateWorkOrder,
  updateWorkOrderStatus
} from "./api";
import {
  compareWorkOrders,
  getAssetLabel,
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
    const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WORK_ORDER_FILTERS;
    }

    const parsed = JSON.parse(raw) as Partial<WorkOrderFilters>;
    return {
      ...DEFAULT_WORK_ORDER_FILTERS,
      ...parsed
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

    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  const updateFilters = (patch: Partial<WorkOrderFilters>) => {
    setFilters((current) => ({
      ...current,
      ...patch
    }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_WORK_ORDER_FILTERS);
  };

  return {
    filters,
    updateFilters,
    resetFilters,
    setFilters
  };
}

function applyWorkOrderFilters(rows: WorkOrder[], filters: WorkOrderFilters): WorkOrder[] {
  const query = filters.query.trim().toLowerCase();
  const from = filters.dueDateFrom ? new Date(`${filters.dueDateFrom}T00:00:00`) : null;
  const to = filters.dueDateTo ? new Date(`${filters.dueDateTo}T23:59:59`) : null;

  return rows
    .filter((order) => {
      const textMatch =
        query.length === 0 ||
        [order.title, order.woNumber, getAssetLabel(order)]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const statusMatch = filters.status === "ALL" || order.status === filters.status;
      const priorityMatch = filters.priority === "ALL" || order.priority === filters.priority;

      const technicianMatch =
        filters.technicianId === "ALL"
          ? true
          : filters.technicianId === "UNASSIGNED"
            ? !order.technicianId
            : order.technicianId === filters.technicianId;

      let dateMatch = true;
      if (from || to) {
        if (!order.dueDate) {
          dateMatch = false;
        } else {
          const dueDate = new Date(order.dueDate);
          if (Number.isNaN(dueDate.getTime())) {
            dateMatch = false;
          } else {
            if (from && dueDate < from) {
              dateMatch = false;
            }
            if (to && dueDate > to) {
              dateMatch = false;
            }
          }
        }
      }

      return textMatch && statusMatch && priorityMatch && technicianMatch && dateMatch;
    })
    .sort((a, b) => compareWorkOrders(a, b, filters.sortBy, filters.sortDirection));
}

function groupByStatus(rows: WorkOrder[]): StatusGroups {
  return groupWorkOrdersByStatus(rows);
}

export function useWorkOrders(filters: WorkOrderFilters) {
  const query = useQuery({
    queryKey: [...WORK_ORDERS_QUERY_KEY, "paginated", filters],
    queryFn: () =>
      fetchWorkOrdersPaginated({
        page: filters.page,
        pageSize: filters.pageSize,
        queue: filters.queue,
        search: filters.query,
        status: filters.status,
        priority: filters.priority,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
        dueDateFrom: filters.dueDateFrom,
        dueDateTo: filters.dueDateTo
      }),
    retry: (failureCount, error) => {
      if (isDatabaseUnavailableError(error)) {
        return false;
      }
      return failureCount < 1;
    },
    placeholderData: (previous) => previous,
    refetchInterval: (q) => (q.state.error ? false : 60_000)
  });

  const sourceRows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const workOrders = useMemo(() => {
    if (filters.technicianId === "ALL") {
      return sourceRows;
    }

    return sourceRows.filter((order) => {
      if (filters.technicianId === "UNASSIGNED") {
        return !order.technicianId;
      }
      return order.technicianId === filters.technicianId;
    });
  }, [filters.technicianId, sourceRows]);

  const groupedByStatus = useMemo(() => groupByStatus(workOrders), [workOrders]);
  const groupedByBoardTab = useMemo(() => groupWorkOrdersByBoardTab(workOrders), [workOrders]);

  const stats = useMemo(() => {
    const summary = query.data?.summary;
    return {
      total: summary?.total ?? query.data?.total ?? 0,
      open: summary?.open ?? 0,
      inProgress: summary?.inProgress ?? 0,
      overdue: summary?.overdue ?? 0,
      completed: workOrders.filter((row) => row.status === "COMPLETED").length
    };
  }, [query.data?.summary, query.data?.total, workOrders]);

  return {
    ...query,
    sourceRows,
    workOrders,
    groupedByStatus,
    groupedByBoardTab,
    stats,
    pagination: {
      page: query.data?.page ?? filters.page,
      pageSize: query.data?.pageSize ?? filters.pageSize,
      total: query.data?.total ?? 0,
      totalPages: query.data?.totalPages ?? 0
    }
  };
}

export function useTechnicians(rows: WorkOrder[]) {
  return useQuery({
    queryKey: WORK_ORDER_TECHNICIANS_QUERY_KEY,
    queryFn: fetchTechnicians,
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
    mutationFn: ({ id, technicianId }: { id: string; technicianId: string }) => assignWorkOrder(id, technicianId),
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
    mutationFn: ({
      ids,
      status,
      payload
    }: {
      ids: string[];
      status: WorkOrderStatus;
      payload?: { actualCost?: number; actualHours?: number };
    }) => bulkUpdateStatus(ids, status, payload),
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
