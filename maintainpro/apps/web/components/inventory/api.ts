import { apiClient } from "@/lib/api-client";

import { InventoryPart, LinkedWorkOrder, PurchaseOrder, StockAdjustmentPayload, StockMovement, SupplierRecord, TopUsedPartPoint, UpdatePartPayload, UsageTrendPoint } from "./types";

type Envelope<T> = {
  data?: T;
  message?: string;
};

function unwrap<T>(payload: Envelope<T> | T | undefined, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload.data ?? fallback) as T;
  }

  return (payload ?? fallback) as T;
}

export async function getInventoryParts(): Promise<InventoryPart[]> {
  const response = await apiClient.get("/inventory/parts");
  return unwrap(response.data, [] as InventoryPart[]);
}

export async function getSuppliers(): Promise<SupplierRecord[]> {
  const response = await apiClient.get("/suppliers");
  return unwrap(response.data, [] as SupplierRecord[]);
}

export async function getLowStockParts(): Promise<InventoryPart[]> {
  const response = await apiClient.get("/inventory/low-stock");
  return unwrap(response.data, [] as InventoryPart[]);
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const response = await apiClient.get("/inventory/purchase-orders");
  return unwrap(response.data, [] as PurchaseOrder[]);
}

export async function getPartMovements(partId: string): Promise<StockMovement[]> {
  const response = await apiClient.get(`/inventory/parts/${partId}/movements`);
  return unwrap(response.data, [] as StockMovement[]);
}

export async function getPartWorkOrders(partId: string): Promise<LinkedWorkOrder[]> {
  const response = await apiClient.get(`/inventory/parts/${partId}/work-orders`);
  return unwrap(response.data, [] as LinkedWorkOrder[]);
}

export async function getPartPurchaseHistory(partId: string): Promise<PurchaseOrder[]> {
  const response = await apiClient.get(`/inventory/parts/${partId}/purchase-history`);
  return unwrap(response.data, [] as PurchaseOrder[]);
}

export async function getUsageTrend(days = 30): Promise<UsageTrendPoint[]> {
  const response = await apiClient.get("/inventory/analytics/usage", {
    params: {
      days
    }
  });

  return unwrap(response.data, [] as UsageTrendPoint[]);
}

export async function getTopUsedParts(limit = 5, days = 30): Promise<TopUsedPartPoint[]> {
  const response = await apiClient.get("/inventory/analytics/top-used", {
    params: {
      limit,
      days
    }
  });

  return unwrap(response.data, [] as TopUsedPartPoint[]);
}

export async function stockInPart(payload: StockAdjustmentPayload): Promise<unknown> {
  const response = await apiClient.post(`/inventory/parts/${payload.id}/stock-in`, {
    quantity: payload.quantity,
    notes: payload.notes
  });

  return unwrap(response.data, null);
}

export async function stockOutPart(payload: StockAdjustmentPayload): Promise<unknown> {
  const response = await apiClient.post(`/inventory/parts/${payload.id}/stock-out`, {
    quantity: payload.quantity,
    notes: payload.notes
  });

  return unwrap(response.data, null);
}

export async function updatePart(payload: UpdatePartPayload): Promise<unknown> {
  const response = await apiClient.patch(`/inventory/parts/${payload.id}`, payload.data);
  return unwrap(response.data, null);
}

export async function deletePart(partId: string): Promise<unknown> {
  const response = await apiClient.delete(`/inventory/parts/${partId}`);
  return unwrap(response.data, null);
}

export async function bulkDeleteParts(ids: string[]): Promise<{ count: number }> {
  const response = await apiClient.post("/inventory/parts/bulk-delete", { ids });
  return unwrap(response.data, { count: 0 });
}

export async function bulkUpdateCategory(ids: string[], category: string): Promise<{ count: number }> {
  const response = await apiClient.patch("/inventory/parts/bulk-category", { ids, category });
  return unwrap(response.data, { count: 0 });
}
