import { BadRequestException } from "@nestjs/common";
import { MaintenanceRequestStatus } from "@prisma/client";
import {
  assertValidTransition,
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

  it("labels APPROVED as Accepted for operators", () => {
    expect(humanRequestStatus(MaintenanceRequestStatus.APPROVED)).toBe("Accepted");
    expect(humanRequestStatus(MaintenanceRequestStatus.CLOSED)).toBe("Closed");
  });
});
