import { RoleName } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

/** Sent-back (REWORK_REQUIRED) jobs carry the supervisor's reason so the technician sees why. */
describe("My Jobs returns the send-back reason", () => {
  const actor = { sub: "tech-1", email: "tech@maintainpro.local", role: RoleName.TECHNICIAN, tenantId: "tenant-1" };
  const base = {
    woNumber: "WO-1",
    title: "Pump",
    priority: "HIGH",
    dueDate: null,
    approvalStatus: "APPROVED",
    type: "CORRECTIVE",
    version: 3,
    asset: null,
    functionalLocation: null,
    site: null
  };

  it("selects verificationRejectionReason and returns it only for rework jobs", async () => {
    const findMany = jest.fn().mockResolvedValue([
      { ...base, id: "wo-1", status: "REWORK_REQUIRED", verificationRejectionReason: "  Belt still loose  " },
      { ...base, id: "wo-2", status: "IN_PROGRESS", verificationRejectionReason: "old reason" }
    ]);
    const prisma = { workOrder: { findMany, count: jest.fn().mockResolvedValue(2) } };
    const service = new WorkOrderQueuesService(prisma as never, {} as never, {} as never);

    const result = await service.listMyJobs(actor as never, {});

    expect(findMany.mock.calls[0][0].select.verificationRejectionReason).toBe(true);
    expect(result.items[0]).toMatchObject({ id: "wo-1", verificationRejectionReason: "Belt still loose" });
    expect(result.items[1]).toMatchObject({ id: "wo-2", verificationRejectionReason: null });
  });
});
