import { allow, deny, firstDenial, type PolicyDecision } from "./policy-decision";

export type StockPolicyInput = {
  tenantId?: string | null;
  itemActive?: boolean;
  warehouseValid?: boolean;
  quantity?: number;
  available?: number;
  onHand?: number;
  reserved?: number;
  adjustmentAuthorized?: boolean;
  originalMovementId?: string | null;
  alreadyReversed?: boolean;
};

export function canPartReserve(input: StockPolicyInput): PolicyDecision {
  return firstDenial(baseStockGuards(input), sufficientAvailable(input));
}

export function canPartIssue(input: StockPolicyInput): PolicyDecision {
  return canPartReserve(input);
}

export function canStockTransfer(input: StockPolicyInput): PolicyDecision {
  return canPartReserve(input);
}

export function canStockAdjust(input: StockPolicyInput): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.itemActive === false ? deny("ITEM_INACTIVE") : allow(),
    input.warehouseValid === false ? deny("WAREHOUSE_INVALID") : allow(),
    quantityPositive(input.quantity),
    input.adjustmentAuthorized === false ? deny("ADJUSTMENT_UNAUTHORIZED", undefined, "CRITICAL") : allow()
  );
}

export function canInventoryImportApply(input: StockPolicyInput & { mappingPresent?: boolean; sourceStatusSafe?: boolean }): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.mappingPresent === false ? deny("ERP_MAPPING_MISSING", undefined, "HIGH") : allow(),
    input.sourceStatusSafe === false ? deny("ERP_SOURCE_STATUS_INVALID") : allow(),
    input.adjustmentAuthorized === false ? deny("ERP_APPLY_UNSAFE", undefined, "CRITICAL") : allow()
  );
}

export function canReverseMovement(input: StockPolicyInput): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.originalMovementId ? allow() : deny("REVERSAL_ORIGINAL_MISSING", undefined, "CRITICAL"),
    input.alreadyReversed ? deny("REVERSAL_ALREADY_APPLIED", undefined, "HIGH") : allow()
  );
}

function baseStockGuards(input: StockPolicyInput): PolicyDecision {
  return firstDenial(
    requireTenant(input.tenantId),
    input.itemActive === false ? deny("ITEM_INACTIVE") : allow(),
    input.warehouseValid === false ? deny("WAREHOUSE_INVALID") : allow(),
    quantityPositive(input.quantity)
  );
}

function quantityPositive(quantity?: number): PolicyDecision {
  if (!Number.isInteger(quantity) || Number(quantity) <= 0) {
    return deny("QUANTITY_INVALID", { quantity });
  }
  return allow();
}

function sufficientAvailable(input: StockPolicyInput): PolicyDecision {
  const requested = Number(input.quantity ?? 0);
  const available = Number(input.available ?? 0);
  if (available < requested) {
    return deny(
      "INSUFFICIENT_STOCK",
      { requested, available, onHand: input.onHand ?? null, reserved: input.reserved ?? null },
      "HIGH"
    );
  }
  return allow();
}

function requireTenant(tenantId?: string | null): PolicyDecision {
  return tenantId ? allow() : deny("TENANT_REQUIRED", undefined, "CRITICAL");
}
