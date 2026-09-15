import { BadRequestException } from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

import {
  ALLOWED_STATUS_TRANSITIONS,
  assertAllowedStatusTransition,
  isTerminalWorkOrderStatus,
  TERMINAL_WORK_ORDER_STATUSES
} from "../src/common/utils/work-order-governance";
import {
  assertValidHoldReason,
  humanWorkOrderStatus,
  isOverdueCondition
} from "../src/modules/work-orders/work-order-lifecycle";

describe("Phase 6 work order lifecycle", () => {
  it("allows canonical happy path transitions", () => {
    expect(() => assertAllowedStatusTransition(WorkOrderStatus.OPEN, WorkOrderStatus.PLANNED)).not.toThrow();
    expect(() => assertAllowedStatusTransition(WorkOrderStatus.PLANNED, WorkOrderStatus.ASSIGNED)).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS)
    ).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD)
    ).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.ON_HOLD, WorkOrderStatus.IN_PROGRESS)
    ).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.TECHNICIAN_COMPLETED)
    ).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.TECHNICIAN_COMPLETED, WorkOrderStatus.VERIFIED)
    ).not.toThrow();
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.VERIFIED, WorkOrderStatus.CLOSED)
    ).not.toThrow();
  });

  it("blocks illegal transitions", () => {
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.CLOSED, WorkOrderStatus.OPEN)
    ).toThrow(BadRequestException);
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.VERIFIED, WorkOrderStatus.IN_PROGRESS)
    ).toThrow(BadRequestException);
    expect(() =>
      assertAllowedStatusTransition(WorkOrderStatus.TECHNICIAN_COMPLETED, WorkOrderStatus.OPEN)
    ).toThrow(BadRequestException);
  });

  it("treats CLOSED and legacy COMPLETED as terminal", () => {
    expect(isTerminalWorkOrderStatus(WorkOrderStatus.CLOSED)).toBe(true);
    expect(isTerminalWorkOrderStatus(WorkOrderStatus.COMPLETED)).toBe(true);
    expect(TERMINAL_WORK_ORDER_STATUSES.has(WorkOrderStatus.CANCELLED)).toBe(true);
  });

  it("derives overdue without using OVERDUE as a required status", () => {
    expect(
      isOverdueCondition({
        dueAt: new Date(Date.now() - 3600_000),
        status: WorkOrderStatus.IN_PROGRESS
      })
    ).toBe(true);
    expect(
      isOverdueCondition({
        dueAt: new Date(Date.now() - 3600_000),
        status: WorkOrderStatus.CLOSED
      })
    ).toBe(false);
  });

  it("requires OTHER hold notes", () => {
    expect(() => assertValidHoldReason("OTHER", "")).toThrow(BadRequestException);
    expect(() => assertValidHoldReason("WAITING_PARTS")).not.toThrow();
  });

  it("humanizes technician completed as Completed", () => {
    expect(humanWorkOrderStatus(WorkOrderStatus.TECHNICIAN_COMPLETED)).toBe("Completed");
    expect(humanWorkOrderStatus(WorkOrderStatus.VERIFIED)).toBe("Verified");
  });

  it("exposes transitions for every status key", () => {
    for (const status of Object.values(WorkOrderStatus)) {
      expect(ALLOWED_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });
});
