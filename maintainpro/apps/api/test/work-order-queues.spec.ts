import { RoleName } from "@prisma/client";

import {
  isWorkOrderOverdue,
  overdueDayCount,
  priorityWeight,
  resolveDefaultQueueForRole,
  roleCanAccessQueue,
  severityWeight,
  WORK_ORDER_QUEUE_LABELS
} from "../src/common/utils/work-order-queues";
import { calculateWorkOrderRiskScore } from "../src/common/utils/maintenance-risk-score";

describe("work order queues", () => {
  it("assigns role-based default queues", () => {
    expect(resolveDefaultQueueForRole(RoleName.TECHNICIAN)).toBe("my-tasks");
    expect(resolveDefaultQueueForRole(RoleName.SUPERVISOR)).toBe("supervisor-verification");
    expect(resolveDefaultQueueForRole(RoleName.INVENTORY_KEEPER)).toBe("waiting-parts");
    expect(resolveDefaultQueueForRole(RoleName.MANAGER)).toBe("action-required");
    expect(resolveDefaultQueueForRole(RoleName.ADMIN)).toBe("action-required");
  });

  it("blocks technicians from all-company queue", () => {
    expect(roleCanAccessQueue(RoleName.TECHNICIAN, "all")).toBe(false);
    expect(roleCanAccessQueue(RoleName.TECHNICIAN, "my-tasks")).toBe(true);
    expect(roleCanAccessQueue(RoleName.ADMIN, "all")).toBe(true);
  });

  it("allows inventory keeper waiting parts queue", () => {
    expect(roleCanAccessQueue(RoleName.INVENTORY_KEEPER, "waiting-parts")).toBe(true);
  });

  it("detects overdue work orders consistently", () => {
    const overdue = isWorkOrderOverdue({
      status: "IN_PROGRESS",
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    });
    expect(overdue).toBe(true);
    expect(overdueDayCount(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))).toBeGreaterThanOrEqual(3);
  });

  it("prioritizes critical risk and overdue sorting weights", () => {
    expect(severityWeight("CRITICAL")).toBeGreaterThan(severityWeight("LOW"));
    expect(priorityWeight("CRITICAL")).toBeGreaterThan(priorityWeight("LOW"));
  });

  it("includes required queue labels", () => {
    expect(WORK_ORDER_QUEUE_LABELS["action-required"]).toBe("Action Required");
    expect(WORK_ORDER_QUEUE_LABELS["supervisor-verification"]).toBe("Supervisor Verification");
    expect(WORK_ORDER_QUEUE_LABELS["high-risk"]).toBe("High Risk");
    expect(WORK_ORDER_QUEUE_LABELS.triage).toBe("Triage / Not Sure");
  });

  it("adds high-risk score without breaking existing scoring", () => {
    const base = calculateWorkOrderRiskScore({ overdue: true });
    const high = calculateWorkOrderRiskScore({ overdue: true, requiredEvidenceMissing: true, highCostPartIssue: true });
    expect(high).toBeGreaterThan(base);
  });
});
