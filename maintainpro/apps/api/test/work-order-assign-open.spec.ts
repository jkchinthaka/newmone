import { WorkOrderApprovalStatus, WorkOrderStatus } from "@prisma/client";

import { assertAssignableStatus } from "../src/common/utils/work-order-governance";

describe("assign from open", () => {
  it("promotes an approved open work order through planned", () => {
    expect(assertAssignableStatus(WorkOrderStatus.OPEN, WorkOrderApprovalStatus.APPROVED)).toEqual({
      promoteFromOpen: true
    });
    expect(assertAssignableStatus(WorkOrderStatus.OPEN, "NOT_REQUIRED")).toEqual({
      promoteFromOpen: true
    });
  });

  it("refuses assignment while approval is pending", () => {
    expect(() => assertAssignableStatus(WorkOrderStatus.OPEN, WorkOrderApprovalStatus.PENDING)).toThrow(
      "Approve this work order before assigning a technician."
    );
  });

  it("keeps planned and assigned assignment", () => {
    expect(assertAssignableStatus(WorkOrderStatus.PLANNED, WorkOrderApprovalStatus.APPROVED).promoteFromOpen).toBe(false);
    expect(assertAssignableStatus(WorkOrderStatus.ASSIGNED, "NOT_REQUIRED").promoteFromOpen).toBe(false);
  });
});
