/** Bileeta owns purchasing stock. MaintainPro records work-order consumption and waits for ERP sync. */
export const STOCK_QUANTITY_OWNER = "BILEETA" as const;

export const WORK_ORDER_PART_CONSUMPTION_EVENT = "WORK_ORDER_PART_CONSUMPTION";
export const WORK_ORDER_PART_RETURN_EVENT = "WORK_ORDER_PART_RETURN";

export type WorkOrderPartConsumptionInput = {
  tenantId: string;
  issueId: string;
  workOrderId: string;
  partRequestId: string;
  partId: string;
  erpCode: string | null;
  quantity: number;
  unitCost: number;
  source?: "PART_REQUEST" | "DIRECT_ADD" | "RETURN";
};

export function workOrderIssueMutatesMirroredStock(): false {
  return false;
}

/** Pending and failed ERP events stay visible. Only a processed event counts as success. */
export function describeErpSyncStatus(status: string | null | undefined) {
  const normalized = (status ?? "PENDING").trim().toUpperCase();
  if (normalized === "FAILED" || normalized === "ERROR") {
    return { status: "FAILED" as const, visible: true, treatedAsSuccess: false };
  }
  if (normalized === "PENDING" || normalized === "") {
    return { status: "PENDING" as const, visible: true, treatedAsSuccess: false };
  }
  return {
    status: normalized,
    visible: true,
    treatedAsSuccess: normalized === "PROCESSED"
  };
}

export function buildWorkOrderPartConsumptionOutbox(input: WorkOrderPartConsumptionInput) {
  return {
    tenantId: input.tenantId,
    eventId: `part-issue:${input.issueId}`,
    eventType: WORK_ORDER_PART_CONSUMPTION_EVENT,
    aggregateType: "PartIssue",
    aggregateId: input.issueId,
    payloadVersion: 1,
    status: "PENDING",
    payload: JSON.stringify({
      owner: STOCK_QUANTITY_OWNER,
      quantityInStockMutated: false,
      workOrderId: input.workOrderId,
      partRequestId: input.partRequestId,
      partId: input.partId,
      erpCode: input.erpCode,
      quantity: input.quantity,
      unitCost: input.unitCost,
      lineCost: input.quantity * input.unitCost,
      source: input.source ?? "PART_REQUEST"
    })
  };
}

export function buildWorkOrderPartReturnOutbox(input: {
  tenantId: string;
  workOrderPartId: string;
  returnedQuantityBefore: number;
  partId: string;
  erpCode: string | null;
  quantity: number;
  workOrderId: string;
}) {
  return {
    tenantId: input.tenantId,
    eventId: `part-return:${input.workOrderPartId}:${input.returnedQuantityBefore}`,
    eventType: WORK_ORDER_PART_RETURN_EVENT,
    aggregateType: "WorkOrderPart",
    aggregateId: input.workOrderPartId,
    payloadVersion: 1,
    status: "PENDING",
    payload: JSON.stringify({
      owner: STOCK_QUANTITY_OWNER,
      quantityInStockMutated: false,
      source: "RETURN",
      workOrderId: input.workOrderId,
      partId: input.partId,
      erpCode: input.erpCode,
      quantity: input.quantity
    })
  };
}
