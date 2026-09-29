import { BadRequestException } from "@nestjs/common";
import { MaintenanceRequestStatus } from "@prisma/client";
import {
  assertValidTransition,
  compareTriageOrder,
  humanRequestStatus,
  mapRejectionTypeToResolution
} from "../src/modules/maintenance-requests/request-lifecycle";

describe("maintenance request lifecycle", () => {
  it("allows closure with resolution instead of REJECTED", () => {
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.UNDER_REVIEW, MaintenanceRequestStatus.CLOSED)
    ).not.toThrow();
    expect(() =>
      assertValidTransition(MaintenanceRequestStatus.UNDER_REVIEW, MaintenanceRequestStatus.REJECTED)
    ).toThrow(BadRequestException);
  });

  it("maps rejection reason types to resolution codes", () => {
    expect(mapRejectionTypeToResolution("DUPLICATE")).toBe("DUPLICATE");
    expect(mapRejectionTypeToResolution("NOT_MAINTENANCE")).toBe("NOT_MAINTENANCE");
    expect(mapRejectionTypeToResolution("INVALID_REQUEST")).toBe("INVALID");
    expect(mapRejectionTypeToResolution("ALREADY_RESOLVED")).toBe("RESOLVED_WITHOUT_WO");
  });

  it("orders the triage queue by urgency then age", () => {
    const olderHigh = { priority: "HIGH", reportedAt: new Date("2026-01-01T00:00:00Z") };
    const newerCritical = { priority: "CRITICAL", reportedAt: new Date("2026-02-01T00:00:00Z") };
    const newerHigh = { priority: "HIGH", reportedAt: new Date("2026-03-01T00:00:00Z") };
    const ordered = [newerHigh, olderHigh, newerCritical].sort(compareTriageOrder);
    expect(ordered.map((row) => row.priority + row.reportedAt.toISOString())).toEqual([
      "CRITICAL2026-02-01T00:00:00.000Z",
      "HIGH2026-01-01T00:00:00.000Z",
      "HIGH2026-03-01T00:00:00.000Z"
    ]);
  });
});
