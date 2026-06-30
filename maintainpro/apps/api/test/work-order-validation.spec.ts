import { BadRequestException } from "@nestjs/common";
import { WorkOrderType } from "@prisma/client";

import {
  assertWorkOrderAssetRules,
  assertValidOptionalObjectId,
  calculateSlaRisk
} from "../src/common/utils/work-order-validation";

describe("work order validation", () => {
  it("allows CORRECTIVE work orders without asset or vehicle", () => {
    expect(() =>
      assertWorkOrderAssetRules({
        type: WorkOrderType.CORRECTIVE,
        assetId: undefined,
        vehicleId: undefined
      })
    ).not.toThrow();
  });

  it("requires asset or vehicle for PREVENTIVE work orders", () => {
    expect(() =>
      assertWorkOrderAssetRules({
        type: WorkOrderType.PREVENTIVE,
        assetId: undefined,
        vehicleId: undefined
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
});
