import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  bulkDeleteParts,
  bulkUpdateCategory,
  deletePart,
  getInventoryDashboard,
  getInventoryParts,
  getLowStockParts,
  getPartMovements,
  getPartPurchaseHistory,
  getPartWorkOrders,
  getPurchaseOrders,
  getSuppliers,
  getTopUsedParts,
  getUsageTrend,
  stockInPart,
  stockOutPart,
  updatePart
} from "./api";
import { calculateInsights, calculateSummary, getErrorMessage } from "./helpers";
import { InventoryDashboardKpis, StockAdjustmentPayload, UpdatePartPayload } from "./types";
import { withTenantScope } from "@/lib/tenant-query";

export const inventoryQueryKeys = {
  parts: ["inventory", "parts"] as const,
  suppliers: ["inventory", "suppliers"] as const,
  lowStock: ["inventory", "low-stock"] as const,
  purchaseOrders: ["inventory", "purchase-orders"] as const,
  usageTrend: ["inventory", "usage-trend"] as const,
  topUsed: ["inventory", "top-used"] as const,
  partMovements: (partId: string) => ["inventory", "part", partId, "movements"] as const,
  partWorkOrders: (partId: string) => ["inventory", "part", partId, "work-orders"] as const,
  partPurchaseHistory: (partId: string) => ["inventory", "part", partId, "purchase-history"] as const,
  dashboard: ["inventory", "dashboard"] as const
};

export function useInventoryOverview() {
  const partsQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.parts),
    queryFn: getInventoryParts,
    refetchOnWindowFocus: true
  });

  const suppliersQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.suppliers),
    queryFn: getSuppliers
  });

  const lowStockQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.lowStock),
    queryFn: getLowStockParts,
    refetchOnWindowFocus: true
  });

  const purchaseOrdersQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.purchaseOrders),
    queryFn: getPurchaseOrders,
    refetchOnWindowFocus: true
  });

  const usageTrendQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.usageTrend),
    queryFn: () => getUsageTrend(30)
  });

  const topUsedQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.topUsed),
    queryFn: () => getTopUsedParts(5, 30)
  });

  const dashboardQuery = useQuery({
    queryKey: withTenantScope(inventoryQueryKeys.dashboard),
    queryFn: getInventoryDashboard,
    refetchOnWindowFocus: true
  });

  const summary = useMemo(() => {
    return calculateSummary(partsQuery.data ?? [], purchaseOrdersQuery.data ?? []);
  }, [partsQuery.data, purchaseOrdersQuery.data]);

  const insights = useMemo(() => {
    return calculateInsights(partsQuery.data ?? [], usageTrendQuery.data ?? [], topUsedQuery.data ?? []);
  }, [partsQuery.data, topUsedQuery.data, usageTrendQuery.data]);

  return {
    partsQuery,
    suppliersQuery,
    lowStockQuery,
    purchaseOrdersQuery,
    usageTrendQuery,
    topUsedQuery,
    dashboardQuery,
    dashboard: (dashboardQuery.data ?? null) as InventoryDashboardKpis | null,
    summary,
    insights
  };
}

export function useInventoryMutations() {
  const queryClient = useQueryClient();

  async function refreshInventoryData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.parts }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lowStock }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.purchaseOrders }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.usageTrend }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.topUsed }),
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: ["inventory", "part"] })
    ]);
  }

  const stockInMutation = useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => stockInPart(payload),
    onSuccess: async () => {
      toast.success("Stock updated successfully.");
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const stockOutMutation = useMutation({
    mutationFn: (payload: StockAdjustmentPayload) => stockOutPart(payload),
    onSuccess: async () => {
      toast.success("Stock updated successfully.");
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const updatePartMutation = useMutation({
    mutationFn: (payload: UpdatePartPayload) => updatePart(payload),
    onSuccess: async () => {
      toast.success("Part updated successfully.");
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const deletePartMutation = useMutation({
    mutationFn: (partId: string) => deletePart(partId),
    onSuccess: async () => {
      toast.success("Part deleted successfully.");
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteParts(ids),
    onSuccess: async (result) => {
      toast.success(`${result.count} part(s) deleted.`);
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  const bulkCategoryMutation = useMutation({
    mutationFn: ({ ids, category }: { ids: string[]; category: string }) => bulkUpdateCategory(ids, category),
    onSuccess: async (result) => {
      toast.success(`${result.count} part(s) updated.`);
      await refreshInventoryData();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    }
  });

  return {
    stockInMutation,
    stockOutMutation,
    updatePartMutation,
    deletePartMutation,
    bulkDeleteMutation,
    bulkCategoryMutation,
    refreshInventoryData
  };
}

export function usePartDetailData(partId?: string | null) {
  const movementsQuery = useQuery({
    queryKey: inventoryQueryKeys.partMovements(partId ?? ""),
    queryFn: () => getPartMovements(partId ?? ""),
    enabled: Boolean(partId)
  });

  const workOrdersQuery = useQuery({
    queryKey: inventoryQueryKeys.partWorkOrders(partId ?? ""),
    queryFn: () => getPartWorkOrders(partId ?? ""),
    enabled: Boolean(partId)
  });

  const purchaseHistoryQuery = useQuery({
    queryKey: inventoryQueryKeys.partPurchaseHistory(partId ?? ""),
    queryFn: () => getPartPurchaseHistory(partId ?? ""),
    enabled: Boolean(partId)
  });

  return {
    movementsQuery,
    workOrdersQuery,
    purchaseHistoryQuery
  };
}
