import { BadRequestException } from "@nestjs/common";
import { WorkOrderType } from "@prisma/client";

import {
  assertWorkOrderAssetRules,
  assertWorkOrderScheduleDates,
  assertValidEntityId,
  assertValidOptionalObjectId,
  calculateSlaRisk,
  parseWorkOrderDateField
} from "../src/common/utils/work-order-validation";

describe("work order validation", () => {
  it("allows CORRECTIVE work orders with functional location only", () => {
    expect(() =>
      assertWorkOrderAssetRules({
        type: WorkOrderType.CORRECTIVE,
        assetId: undefined,
        vehicleId: undefined,
        functionalLocationId: "507f1f77bcf86cd799439011"
      })
    ).not.toThrow();
  });

  it("rejects CORRECTIVE without asset, vehicle, or functional location", () => {
    expect(() =>
      assertWorkOrderAssetRules({
        type: WorkOrderType.CORRECTIVE,
        assetId: undefined,
        vehicleId: undefined
      })
    ).toThrow(BadRequestException);
  });

  it("requires asset or vehicle for PREVENTIVE work orders", () => {
    expect(() =>
      assertWorkOrderAssetRules({
        type: WorkOrderType.PREVENTIVE,
        assetId: undefined,
        vehicleId: undefined,
        functionalLocationId: "507f1f77bcf86cd799439011"
      })
    ).toThrow(BadRequestException);
  });

  it("accepts vehicle link for INSPECTION without asset", () => {
    const result = assertWorkOrderAssetRules({
      type: WorkOrderType.INSPECTION,
      assetId: undefined,
      vehicleId: "507f1f77bcf86cd799439011"
    });

    expect(result.vehicleId).toBe("507f1f77bcf86cd799439011");
  });

  it("normalizes empty asset id to undefined", () => {
    expect(assertValidOptionalObjectId("assetId", "  ")).toBeUndefined();
  });

  it("accepts cuid and UUID creator ids", () => {
    expect(assertValidEntityId("createdById", "clxyz0123456789abcdefgh")).toBe("clxyz0123456789abcdefgh");
    expect(assertValidEntityId("createdById", "550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000"
    );
    expect(assertValidEntityId("createdById", "507f1f77bcf86cd799439011")).toBe("507f1f77bcf86cd799439011");
  });

  it("rejects malformed creator ids", () => {
    expect(() => assertValidEntityId("createdById", "bad id")).toThrow(BadRequestException);
  });

  it("calculates overdue SLA risk", () => {
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const risk = calculateSlaRisk({
      dueDate: past,
      status: "IN_PROGRESS",
      now: new Date()
    });

    expect(risk.level).toBe("OVERDUE");
    expect(risk.delayDays).toBeGreaterThan(0);
  });

  it("treats CLOSED as non-SLA terminal", () => {
    const risk = calculateSlaRisk({
      dueDate: new Date(Date.now() - 86400000),
      status: "CLOSED"
    });
    expect(risk.level).toBe("NONE");
  });

  it("rejects invalid date strings", () => {
    expect(() => parseWorkOrderDateField("dueDate", "not-a-date")).toThrow(BadRequestException);
  });

  it("returns undefined for blank date strings", () => {
    expect(parseWorkOrderDateField("dueDate", "  ")).toBeUndefined();
  });

  it("rejects due date earlier than planned start", () => {
    expect(() =>
      assertWorkOrderScheduleDates({
        plannedStartAt: new Date("2026-10-10T00:00:00.000Z"),
        dueDate: new Date("2026-10-01T00:00:00.000Z")
      })
    ).toThrow(new BadRequestException("Due date must not be earlier than planned start"));
  });

  it("rejects expected completion earlier than planned start", () => {
    expect(() =>
      assertWorkOrderScheduleDates({
        plannedStartAt: new Date("2026-10-10T00:00:00.000Z"),
        expectedCompletionDate: new Date("2026-10-05T00:00:00.000Z")
      })
    ).toThrow(new BadRequestException("Expected completion must not be earlier than planned start"));
  });

  it("rejects planned end earlier than planned start", () => {
    expect(() =>
      assertWorkOrderScheduleDates({
        plannedStartAt: new Date("2026-10-10T00:00:00.000Z"),
        plannedEndAt: new Date("2026-10-09T00:00:00.000Z")
      })
    ).toThrow(new BadRequestException("Planned end must not be earlier than planned start"));
  });
});
