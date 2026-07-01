import { apiClient } from "@/lib/api-client";

export type WorkOrderPartLineStatus =
  | "REQUESTED"
  | "APPROVED"
  | "RESERVED"
  | "ISSUED"
  | "PARTIALLY_USED"
  | "USED"
  | "PARTIALLY_RETURNED"
  | "RETURNED"
  | "DAMAGED"
  | "CLOSED";

export type PartReturnCondition = "UNUSED" | "USED_DAMAGED" | "SCRAP" | "WRONG_PART";

export interface WorkOrderPartLine {
  id: string;
  workOrderId: string;
  partId: string;
  partRequestId?: string | null;
  lineStatus: WorkOrderPartLineStatus;
  approvalTier?: string | null;
  procurementRequired?: boolean;
  requestedQuantity: number;
  approvedQuantity?: number | null;
  issuedQuantity: number;
  usedQuantity: number;
  returnedQuantity: number;
  damagedQuantity?: number;
  pendingReturnQuantity?: number;
  unitCost: number;
  totalCost: number;
  part?: {
    id: string;
    name: string;
    partNumber?: string | null;
    sku?: string | null;
    quantityInStock?: number;
    unitCost?: number;
  } | null;
  partRequest?: {
    id: string;
    status: string;
    reason?: string | null;
    requiresFinanceApproval?: boolean;
  } | null;
}

export interface WorkOrderPartsCostSummary {
  requestedCost: number;
  approvedCost: number;
  issuedCost: number;
  usedCost: number;
  returnedValue: number;
  netPartCost: number;
  lineCount: number;
  unaccountedLines: number;
}

export interface PartsExceptionSummary {
  duplicatePartRequests: number;
  partsIssuedJobNotCompleted: number;
  partsIssuedAfterCompletion: number;
  issuedPartsNotAccounted: number;
  pendingReturnConfirmations: number;
  highCostPartIssues: number;
  procurementRequiredParts: number;
  frequentAssetPartUsage: number;
  generatedAt: string;
  notes?: string[];
}

function unwrap<T>(payload: unknown, fallback: T): T {
  if (payload && typeof payload === "object" && "data" in (payload as Record<string, unknown>)) {
    return ((payload as { data?: T }).data ?? fallback) as T;
  }
  return (payload ?? fallback) as T;
}

export async function listWorkOrderPartLines(workOrderId: string): Promise<WorkOrderPartLine[]> {
  const res = await apiClient.get(`/work-orders/${workOrderId}/parts`);
  return unwrap(res.data, [] as WorkOrderPartLine[]);
}

export async function getWorkOrderPartsSummary(workOrderId: string): Promise<WorkOrderPartsCostSummary> {
  const res = await apiClient.get(`/work-orders/${workOrderId}/parts/summary`);
  return unwrap(res.data, {
    requestedCost: 0,
    approvedCost: 0,
    issuedCost: 0,
    usedCost: 0,
    returnedValue: 0,
    netPartCost: 0,
    lineCount: 0,
    unaccountedLines: 0
  });
}

export async function markPartUsed(
  workOrderId: string,
  lineId: string,
  payload: { usedQuantity: number; note?: string }
): Promise<WorkOrderPartLine> {
  const res = await apiClient.patch(`/work-orders/${workOrderId}/parts/${lineId}/use`, payload);
  return unwrap(res.data, {} as WorkOrderPartLine);
}

export async function requestPartReturn(
  workOrderId: string,
  lineId: string,
  payload: { returnedQuantity: number; returnCondition: PartReturnCondition; returnNote?: string }
): Promise<WorkOrderPartLine> {
  const res = await apiClient.post(`/work-orders/${workOrderId}/parts/${lineId}/return`, payload);
  return unwrap(res.data, {} as WorkOrderPartLine);
}

export async function confirmPartReturn(
  workOrderId: string,
  lineId: string,
  payload: { confirmedQuantity: number; note?: string }
): Promise<WorkOrderPartLine> {
  const res = await apiClient.post(`/work-orders/${workOrderId}/parts/${lineId}/confirm-return`, payload);
  return unwrap(res.data, {} as WorkOrderPartLine);
}

export async function fetchPartsExceptions(): Promise<PartsExceptionSummary> {
  const res = await apiClient.get("/work-orders/governance/parts-exceptions");
  return unwrap(res.data, {
    duplicatePartRequests: 0,
    partsIssuedJobNotCompleted: 0,
    partsIssuedAfterCompletion: 0,
    issuedPartsNotAccounted: 0,
    pendingReturnConfirmations: 0,
    highCostPartIssues: 0,
    procurementRequiredParts: 0,
    frequentAssetPartUsage: 0,
    generatedAt: new Date().toISOString()
  });
}

export function pendingPartQuantity(line: WorkOrderPartLine): number {
  const issued = line.issuedQuantity ?? 0;
  const used = line.usedQuantity ?? 0;
  const returned = line.returnedQuantity ?? 0;
  const damaged = line.damagedQuantity ?? 0;
  const pendingReturn = line.pendingReturnQuantity ?? 0;
  return Math.max(0, issued - used - returned - damaged - pendingReturn);
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Cost data not available.";
  }
  return `Rs. ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
