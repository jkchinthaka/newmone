import { allow, deny, type PolicyDecision } from "./policy-decision";

export type ProcurementInputs = {
  onHand: number;
  reserved: number;
  incoming?: number;
  expectedUsage?: number;
  upcomingPmNeed?: number;
  targetStock?: number;
  reorderPoint?: number;
  minimum?: number;
  pendingPurchase?: number;
};

export type ProcurementResult = {
  netAvailable: number;
  forecastNeed: number;
  suggestedQuantity: number;
  priority: "OUT_OF_STOCK" | "CRITICAL" | "FORECAST_SHORTAGE" | "LOW_STOCK" | "NORMAL" | "NO_PURCHASE_REQUIRED";
  reasonCodes: string[];
};

export function evaluateReorder(input: ProcurementInputs): ProcurementResult {
  const onHand = Math.max(0, Number(input.onHand) || 0);
  const reserved = Math.max(0, Number(input.reserved) || 0);
  const incoming = Math.max(0, Number(input.incoming) || 0);
  const pending = Math.max(0, Number(input.pendingPurchase) || 0);
  const available = Math.max(0, onHand - reserved);
  const netAvailable = available + incoming + pending;
  const forecastNeed = Math.max(0, Number(input.expectedUsage) || 0) + Math.max(0, Number(input.upcomingPmNeed) || 0);
  const target = Math.max(Number(input.targetStock) || 0, Number(input.minimum) || 0, Number(input.reorderPoint) || 0);
  const suggestedQuantity = Math.max(0, target + forecastNeed - netAvailable);

  const reasonCodes: string[] = [];
  let priority: ProcurementResult["priority"] = "NO_PURCHASE_REQUIRED";
  if (available <= 0) {
    priority = "OUT_OF_STOCK";
    reasonCodes.push("OUT_OF_STOCK");
  } else if ((input.reorderPoint ?? 0) > 0 && available <= Number(input.reorderPoint)) {
    priority = "LOW_STOCK";
    reasonCodes.push("LOW_STOCK");
  }
  if (forecastNeed > available) {
    reasonCodes.push("FORECAST_SHORTAGE");
    if (priority === "NO_PURCHASE_REQUIRED" || priority === "LOW_STOCK") {
      priority = "FORECAST_SHORTAGE";
    }
  }
  if (priority === "OUT_OF_STOCK" && forecastNeed > 0) {
    reasonCodes.push("CRITICAL_DEMAND");
  }
  if (suggestedQuantity <= 0) {
    return {
      netAvailable,
      forecastNeed,
      suggestedQuantity: 0,
      priority: "NO_PURCHASE_REQUIRED",
      reasonCodes: reasonCodes.length ? reasonCodes : ["NO_PURCHASE_REQUIRED"]
    };
  }
  if (priority === "NO_PURCHASE_REQUIRED") {
    priority = "NORMAL";
    reasonCodes.push("BELOW_TARGET");
  }
  return { netAvailable, forecastNeed, suggestedQuantity, priority, reasonCodes };
}

export function canPurchaseRecommendationCreate(input: {
  tenantId?: string | null;
  suggestedQuantity: number;
  duplicateOpen?: boolean;
}): PolicyDecision {
  if (!input.tenantId) {
    return deny("TENANT_REQUIRED", undefined, "CRITICAL");
  }
  if (input.duplicateOpen) {
    return deny("PROCUREMENT_DUPLICATE");
  }
  if (input.suggestedQuantity <= 0) {
    return deny("PROCUREMENT_NO_QUANTITY");
  }
  return allow();
}
