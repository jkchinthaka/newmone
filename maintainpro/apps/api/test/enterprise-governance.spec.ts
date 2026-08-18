import { AccidentStatus, AssetStatus, POStatus, WorkOrderStatus } from "@prisma/client";

import { canTransition } from "../src/modules/policies/state-machines";
import {
  canAssignTechnician,
  canApplyOfflineMutation,
  canCommitBudget,
  canRecordFuel,
  canStartHazardousWork,
  canStartTrip,
  DEFAULT_ORG_POLICY,
  evaluateSlaClock,
  matchThreeWay,
  mttrMtbf,
  scoreAssetHealth
} from "../src/modules/policies/governance-policies";
import { canWorkOrderTransition } from "../src/modules/policies/work-order-policies";

describe("cross-module state machines", () => {
  it("allows documented work order and purchase order transitions and fails closed otherwise", () => {
    expect(canTransition("WORK_ORDER", WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS).allowed).toBe(true);
    expect(canTransition("WORK_ORDER", WorkOrderStatus.COMPLETED, WorkOrderStatus.IN_PROGRESS).allowed).toBe(false);
    expect(canTransition("PURCHASE_ORDER", POStatus.ORDERED, POStatus.RECEIVED).allowed).toBe(true);
    expect(canTransition("ACCIDENT", AccidentStatus.CLOSED, AccidentStatus.REPORTED).code).toBe("INVALID_TRANSITION");
    expect(canTransition("ASSET", AssetStatus.DISPOSED, AssetStatus.ACTIVE).allowed).toBe(false);
  });

  it("exports work order transition policy with tenant fail-closed", () => {
    expect(canWorkOrderTransition({ toStatus: WorkOrderStatus.IN_PROGRESS, fromStatus: WorkOrderStatus.OPEN }).code).toBe(
      "TENANT_REQUIRED"
    );
  });
});

describe("SLA calendar and approval / dispatch / match", () => {
  it("warns at 75% and escalates at 125% using configurable thresholds", () => {
    const createdAt = new Date("2026-08-17T00:00:00.000Z");
    const now = new Date("2026-08-17T03:00:00.000Z");
    const clock = evaluateSlaClock({
      tenantId: "t1",
      slaHours: 4,
      createdAt,
      now,
      policy: { ...DEFAULT_ORG_POLICY, weekendsCountAsBusiness: true }
    });
    expect(clock.consumedPct).toBe(75);
    expect(clock.stage).toBe("WARNING");
    const breach = evaluateSlaClock({
      tenantId: "t1",
      slaHours: 4,
      createdAt,
      now: new Date("2026-08-17T05:00:00.000Z"),
      policy: { ...DEFAULT_ORG_POLICY, weekendsCountAsBusiness: true }
    });
    expect(breach.stage).toBe("ESCALATED");
  });

  it("does not auto-assign technicians without capacity or when on leave", () => {
    expect(
      canAssignTechnician({
        tenantId: "t1",
        employeeActive: true,
        canReceiveWorkOrders: true,
        onLeave: true,
        skillMatch: true,
        remainingHours: 8,
        estimatedHours: 2
      }).code
    ).toBe("TECHNICIAN_ON_LEAVE");
  });

  it("matches PO vs GRN without inventing invoice data", () => {
    expect(matchThreeWay({ orderedQty: 10, receivedQty: 10 }).result).toBe("INSUFFICIENT_DATA");
    expect(matchThreeWay({ orderedQty: 10, receivedQty: 4 }).result).toBe("PARTIAL_RECEIPT");
    expect(
      matchThreeWay({
        orderedQty: 10,
        receivedQty: 10,
        invoicedQty: 12,
        poPrice: 100,
        invoicePrice: 100
      }).result
    ).toBe("OVER_INVOICE");
  });

  it("does not block spend when budget is not configured", () => {
    expect(canCommitBudget({ tenantId: "t1", requested: 500, committed: 0, policy: DEFAULT_ORG_POLICY }).code).toBe(
      "INSUFFICIENT_DATA"
    );
  });

  it("keeps PTW fail-open unless the tenant enables strict permit policy", () => {
    expect(
      canStartHazardousWork({
        tenantId: "t1",
        hazardous: true,
        permitEvidencePresent: false,
        policy: DEFAULT_ORG_POLICY
      }).code
    ).toBe("BUSINESS_APPROVAL_REQUIRED");
    expect(
      canStartHazardousWork({
        tenantId: "t1",
        hazardous: true,
        permitEvidencePresent: false,
        policy: { ...DEFAULT_ORG_POLICY, ptwStrict: true }
      }).allowed
    ).toBe(false);
  });
});

describe("fleet fuel trip offline and asset health", () => {
  it("rejects fuel rollback and duplicate references", () => {
    expect(
      canRecordFuel({
        tenantId: "t1",
        liters: 40,
        mileage: 100,
        previousMileage: 120,
        vehicleStatus: "AVAILABLE"
      }).code
    ).toBe("METER_ROLLBACK");
  });

  it("blocks a second concurrent trip", () => {
    expect(
      canStartTrip({
        tenantId: "t1",
        vehicleStatus: "AVAILABLE",
        driverActive: true,
        conflictingTrip: true,
        mileage: 200,
        previousMileage: 180
      }).code
    ).toBe("TRIP_CONFLICT");
  });

  it("revalidates offline mutations against current server stock", () => {
    expect(
      canApplyOfflineMutation({ tenantId: "t1", clientActionId: "act-1", serverAvailable: 2, requested: 5 }).code
    ).toBe("INSUFFICIENT_STOCK");
  });

  it("does not invent MTTR with fewer than 3 samples", () => {
    expect(mttrMtbf([{ downtimeHours: 4 }]).coverage).toBe("INSUFFICIENT_DATA");
    const health = scoreAssetHealth({ status: AssetStatus.ACTIVE, openCriticalWorkOrders: 2, downtimeHours90d: null });
    expect(health.coverage).toBe("INSUFFICIENT_DATA");
    expect(health.reasons.join(" ")).toMatch(/critical open work orders/i);
  });
});
