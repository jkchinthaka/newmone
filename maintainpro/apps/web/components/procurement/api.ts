import { apiClient } from "@/lib/api-client";

export type PurchaseOrderStatus = "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type WorkflowStatus = "PENDING_OPERATIONAL" | "PENDING_FINANCE" | "APPROVED" | "REJECTED";
export type ApprovalStage = "OPERATIONAL" | "FINANCE";
export type ApprovalDecisionStatus = "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
export type ErpSyncStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface PurchaseOrderApproval {
  id: string;
  stage: ApprovalStage;
  status: ApprovalDecisionStatus;
  sequence: number;
  decisionNotes?: string | null;
  decidedById?: string | null;
  decidedAt?: string | null;
}

export interface PurchaseOrderErpSync {
  id: string;
  provider: string;
  status: ErpSyncStatus;
  attemptNumber: number;
  errorMessage?: string | null;
  nextRetryAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface PurchaseOrderLine {
  id: string;
  sparePartId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrderWorkflowRecord {
  id: string;
  poNumber: string;
  supplierId: string;
  totalAmount: number;
  status: PurchaseOrderStatus;
  workflowStatus: WorkflowStatus;
  requiresFinanceApproval: boolean;
  tenantId?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string } | null;
  approvals?: PurchaseOrderApproval[];
  erpSyncAttempts?: PurchaseOrderErpSync[];
  lines?: PurchaseOrderLine[];
}

function unwrap<T>(payload: unknown, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload ?? fallback) as T;
}

export async function listPurchaseOrders(): Promise<PurchaseOrderWorkflowRecord[]> {
  const res = await apiClient.get("/inventory/purchase-orders");
  return unwrap(res.data, [] as PurchaseOrderWorkflowRecord[]);
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderWorkflowRecord> {
  const res = await apiClient.get(`/inventory/purchase-orders/${id}`);
  return unwrap(res.data, {} as PurchaseOrderWorkflowRecord);
}

export async function approveOperational(id: string, reason?: string): Promise<PurchaseOrderWorkflowRecord> {
  const res = await apiClient.patch(`/inventory/purchase-orders/${id}/approve-operational`, { reason });
  return unwrap(res.data, {} as PurchaseOrderWorkflowRecord);
}

export async function approveFinance(id: string, reason?: string): Promise<PurchaseOrderWorkflowRecord> {
  const res = await apiClient.patch(`/inventory/purchase-orders/${id}/approve-finance`, { reason });
  return unwrap(res.data, {} as PurchaseOrderWorkflowRecord);
}

export async function rejectPurchaseOrder(id: string, reason: string): Promise<PurchaseOrderWorkflowRecord> {
  const res = await apiClient.patch(`/inventory/purchase-orders/${id}/reject`, { reason });
  return unwrap(res.data, {} as PurchaseOrderWorkflowRecord);
}

export async function executeErpSync(id: string): Promise<PurchaseOrderErpSync> {
  const res = await apiClient.post(`/inventory/purchase-orders/${id}/erp-sync`);
  return unwrap(res.data, {} as PurchaseOrderErpSync);
}

export async function retryErpSync(id: string): Promise<PurchaseOrderErpSync> {
  const res = await apiClient.post(`/inventory/purchase-orders/${id}/erp-sync/retry`);
  return unwrap(res.data, {} as PurchaseOrderErpSync);
}
