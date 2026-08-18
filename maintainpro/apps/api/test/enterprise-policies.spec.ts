import { canPartReserve } from "../src/modules/policies/inventory-policies";
import { canVehicleGateOut } from "../src/modules/policies/vehicle-policies";
import { canWorkOrderComplete, canWorkOrderReopen, canWorkOrderStart } from "../src/modules/policies/work-order-policies";
import { deny } from "../src/modules/policies/policy-decision";
import { nextPreventiveDue, forecastServiceDue, canMeterReadingAdvance } from "../src/modules/policies/maintenance-policies";
import { evaluateReorder, canPurchaseRecommendationCreate } from "../src/modules/policies/procurement-policies";
import { evaluatePartCompatibility, canIssuePartToVehicle, isWithinWarranty } from "../src/modules/policies/parts-policies";
import { scoreVehicleHealth } from "../src/modules/policies/health-score";
import { WorkOrderApprovalStatus, WorkOrderStatus } from "@prisma/client";

describe("central operational policies", () => {
  it("denies reservation when available stock is insufficient", () => {
    const decision = canPartReserve({
      tenantId: "t1",
      itemActive: true,
      warehouseValid: true,
      quantity: 10,
      available: 8,
      onHand: 20,
      reserved: 12
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("INSUFFICIENT_STOCK");
    expect(decision.metadata).toEqual({ requested: 10, available: 8, onHand: 20, reserved: 12 });
  });

  it("fails closed without tenant context", () => {
    expect(canPartReserve({ quantity: 1, available: 5 }).allowed).toBe(false);
    expect(canVehicleGateOut({ status: "AVAILABLE" }).code).toBe("TENANT_REQUIRED");
    expect(canWorkOrderStart({ fromStatus: WorkOrderStatus.OPEN, assigned: true }).code).toBe("TENANT_REQUIRED");
  });

  it("blocks gate-out for overdue maintenance unless override is authorized", () => {
    const blocked = canVehicleGateOut({
      tenantId: "t1",
      status: "AVAILABLE",
      maintenanceCriticallyOverdue: true
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.code).toBe("MAINTENANCE_CRITICALLY_OVERDUE");
    const override = canVehicleGateOut({
      tenantId: "t1",
      status: "AVAILABLE",
      maintenanceCriticallyOverdue: true,
      overrideRequested: true,
      overrideAuthorized: true,
      overrideReason: "Approved by operations manager"
    });
    expect(override.allowed).toBe(true);
    expect(override.code).toBe("GATE_OUT_OVERRIDE");
  });

  it("enforces work order start/complete/reopen rules", () => {
    expect(
      canWorkOrderStart({
        tenantId: "t1",
        fromStatus: WorkOrderStatus.OPEN,
        assigned: false,
        approvalStatus: WorkOrderApprovalStatus.APPROVED
      }).code
    ).toBe("WO_ASSIGNMENT_REQUIRED");
    expect(
      canWorkOrderComplete({
        tenantId: "t1",
        fromStatus: WorkOrderStatus.TECHNICIAN_COMPLETED,
        toStatus: WorkOrderStatus.COMPLETED,
        assigned: true,
        evidenceComplete: false
      }).code
    ).toBe("WO_EVIDENCE_REQUIRED");
    expect(canWorkOrderReopen({ tenantId: "t1", actorRole: "TECHNICIAN" }).code).toBe("WO_REOPEN_UNAUTHORIZED");
  });
});

describe("PM forecast and meter policies", () => {
  it("advances actual completion by interval without inventing a due point", () => {
    const completedAt = new Date("2026-08-01T00:00:00.000Z");
    const result = nextPreventiveDue({
      policy: "ACTUAL_COMPLETION",
      completedAt,
      completedMileage: 48800,
      intervalDays: 180,
      intervalMileage: 10000
    });
    expect(result.allowed).toBe(true);
    expect(result.nextDueMileage).toBe(58800);
    expect(result.nextDueDate?.toISOString()).toBe("2027-01-28T00:00:00.000Z");
  });

  it("returns INSUFFICIENT_DATA instead of inventing a forecast", () => {
    const forecast = forecastServiceDue({ currentMileage: 48800, nextDueMileage: 50000 });
    expect(forecast.coverage).toBe("INSUFFICIENT_DATA");
    expect(forecast.estimatedDueDate).toBeNull();
  });

  it("forecasts remaining days when usage coverage exists", () => {
    const forecast = forecastServiceDue({
      currentMileage: 48800,
      nextDueMileage: 50000,
      avgKmPerDay: 200,
      sampleDays: 21
    });
    expect(forecast.coverage).toBe("COMPLETE");
    expect(forecast.remainingDays).toBeCloseTo(6);
  });

  it("blocks meter rollback", () => {
    expect(canMeterReadingAdvance({ previous: 1000, next: 900 }).code).toBe("METER_ROLLBACK");
    expect(canMeterReadingAdvance({ previous: 1000, next: 1100 }).allowed).toBe(true);
  });
});

describe("procurement, warranty, health", () => {
  it("never suggests a negative order quantity", () => {
    const result = evaluateReorder({
      onHand: 20,
      reserved: 5,
      incoming: 10,
      upcomingPmNeed: 4,
      targetStock: 12
    });
    expect(result.suggestedQuantity).toBe(0);
    expect(result.priority).toBe("NO_PURCHASE_REQUIRED");
  });

  it("blocks duplicate purchase recommendations", () => {
    expect(
      canPurchaseRecommendationCreate({ tenantId: "t1", suggestedQuantity: 4, duplicateOpen: true }).code
    ).toBe("PROCUREMENT_DUPLICATE");
  });

  it("treats unknown compatibility as a warning, not a block", () => {
    expect(evaluatePartCompatibility([], { make: "Toyota" })).toBe("UNKNOWN");
    expect(canIssuePartToVehicle({ compatibility: "UNKNOWN" }).allowed).toBe(true);
    expect(canIssuePartToVehicle({ compatibility: "INCOMPATIBLE" }).allowed).toBe(false);
  });

  it("detects in-warranty failures without forcing a purchase", () => {
    expect(
      isWithinWarranty({
        installedAt: new Date("2026-08-01"),
        installedMileage: 10000,
        warrantyExpiresAt: new Date("2027-02-01"),
        warrantyMileage: 20000,
        failedAt: new Date("2026-10-01"),
        failedMileage: 15000
      })
    ).toBe(true);
  });

  it("produces an explainable health score", () => {
    const scored = scoreVehicleHealth({
      maintenanceOverdueKm: 850,
      criticalOpenWorkOrders: 2,
      complianceExpiringDays: 4,
      recentBreakdowns90d: 3
    });
    expect(scored.score).toBeLessThan(60);
    expect(scored.reasons.join(" ")).toContain("Service overdue");
    expect(scored.reasons.join(" ")).toContain("critical open work orders");
  });

  it("deny helper is fail-closed", () => {
    expect(deny("TENANT_REQUIRED").allowed).toBe(false);
  });
});
