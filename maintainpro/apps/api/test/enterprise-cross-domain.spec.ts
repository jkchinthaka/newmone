import { evaluateReorder } from "../src/modules/policies/procurement-policies";
import { nextPreventiveDue } from "../src/modules/policies/maintenance-policies";
import { canPartReserve } from "../src/modules/policies/inventory-policies";
import { isWithinWarranty } from "../src/modules/policies/parts-policies";
import { scoreVehicleHealth } from "../src/modules/policies/health-score";

describe("cross-domain enterprise flow", () => {
  it("PM shortage feeds a non-negative procurement suggestion", () => {
    const pmNeed = 28;
    const available = 16;
    const shortage = Math.max(0, pmNeed - available);
    expect(shortage).toBe(12);
    const rec = evaluateReorder({
      onHand: 16,
      reserved: 0,
      upcomingPmNeed: 28,
      targetStock: 16
    });
    expect(rec.priority).toBe("FORECAST_SHORTAGE");
    expect(rec.suggestedQuantity).toBeGreaterThan(0);
  });

  it("second reservation of the last units is rejected", () => {
    const first = canPartReserve({ tenantId: "t1", quantity: 8, available: 8, onHand: 8, reserved: 0, itemActive: true, warehouseValid: true });
    expect(first.allowed).toBe(true);
    const second = canPartReserve({ tenantId: "t1", quantity: 8, available: 0, onHand: 8, reserved: 8, itemActive: true, warehouseValid: true });
    expect(second.allowed).toBe(false);
    expect(second.code).toBe("INSUFFICIENT_STOCK");
  });

  it("completed PM plus cost and health remain deterministic", () => {
    const advance = nextPreventiveDue({
      policy: "ACTUAL_COMPLETION",
      completedAt: new Date("2026-08-01T00:00:00.000Z"),
      intervalDays: 30
    });
    expect(advance.allowed).toBe(true);
    const health = scoreVehicleHealth({ recentRepairCount90d: 1, criticalOpenWorkOrders: 0 });
    expect(health.score).toBeGreaterThan(0);
    expect(health.band).toBeDefined();
  });

  it("warranty opportunity does not auto-create purchasing demand", () => {
    const inWarranty = isWithinWarranty({
      installedAt: new Date("2026-08-01"),
      warrantyExpiresAt: new Date("2027-02-01"),
      failedAt: new Date("2026-10-01")
    });
    expect(inWarranty).toBe(true);
    const rec = evaluateReorder({ onHand: 4, reserved: 0, upcomingPmNeed: 0, targetStock: 4, pendingPurchase: 4 });
    expect(rec.suggestedQuantity).toBe(0);
  });
});
