import { apiClient } from "@/lib/api-client";

export type PartRequestStatus =
  | "PENDING_OPERATIONAL"
  | "PENDING_FINANCE"
  | "APPROVED"
  | "REJECTED"
  | "ISSUED";

export interface PartRequest {
  id: string;
  workOrderId: string;
  partId: string;
  sparePartId?: string;
  quantity: number;
  status: PartRequestStatus;
  reason?: string | null;
  notes?: string | null;
  requestedById: string;
  createdAt: string;
  updatedAt: string;
  sparePart?: { id: string; name: string; partNumber: string; quantityInStock?: number } | null;
}

function unwrap<T>(payload: unknown, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload ?? fallback) as T;
}

export async function listPartRequests(workOrderId: string): Promise<PartRequest[]> {
  const res = await apiClient.get(`/work-orders/${workOrderId}/part-requests`);
  return unwrap(res.data, [] as PartRequest[]);
}

export async function createPartRequest(
  workOrderId: string,
  payload: { partId: string; quantity: number; unitCost?: number; reason?: string; pettyCash?: boolean }
): Promise<PartRequest> {
  const res = await apiClient.post(`/work-orders/${workOrderId}/part-requests`, payload);
  return unwrap(res.data, {} as PartRequest);
}

export async function approvePartRequestOperational(
  workOrderId: string,
  partRequestId: string,
  reason?: string,
  approvedQuantity?: number
): Promise<PartRequest> {
  const res = await apiClient.patch(
    `/work-orders/${workOrderId}/part-requests/${partRequestId}/approve-operational`,
    { reason, approvedQuantity }
  );
  return unwrap(res.data, {} as PartRequest);
}

export async function approvePartRequestFinance(
  workOrderId: string,
  partRequestId: string,
  reason?: string,
  approvedQuantity?: number
): Promise<PartRequest> {
  const res = await apiClient.patch(
    `/work-orders/${workOrderId}/part-requests/${partRequestId}/approve-finance`,
    { reason, approvedQuantity }
  );
  return unwrap(res.data, {} as PartRequest);
}

export async function rejectPartRequest(
  workOrderId: string,
  partRequestId: string,
  reason: string,
  stage?: "OPERATIONAL" | "FINANCE"
): Promise<PartRequest> {
  const res = await apiClient.patch(
    `/work-orders/${workOrderId}/part-requests/${partRequestId}/reject`,
    { reason, stage }
  );
  return unwrap(res.data, {} as PartRequest);
}

export async function issuePartRequest(
  workOrderId: string,
  partRequestId: string,
  payload?: { quantity?: number; notes?: string }
): Promise<PartRequest> {
  const res = await apiClient.post(
    `/work-orders/${workOrderId}/part-requests/${partRequestId}/issue`,
    payload ?? {}
  );
  return unwrap(res.data, {} as PartRequest);
}
