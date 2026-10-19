import { RoleName } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

/** H-1: My Jobs actions send the row version, so the list must return it. */
describe("My Jobs returns the work-order version", () => {
  const actor = { sub: "tech-1", email: "tech@maintainpro.local", role: RoleName.TECHNICIAN, tenantId: "tenant-1" };

  it("selects version and includes it on every item", async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: "wo-1",
        woNumber: "WO-1",
        title: "Pump",
        status: "ASSIGNED",
        priority: "HIGH",
        dueDate: null,
        approvalStatus: "APPROVED",
        type: "CORRECTIVE",
        version: 7,
        asset: null,
        functionalLocation: null,
        site: null,
        parts: [],
        partIssues: [],
        evidenceAttachments: []
      }
    ]);
    const prisma = { workOrder: { findMany, count: jest.fn().mockResolvedValue(1) } };
    const service = new WorkOrderQueuesService(prisma as never, {} as never, {} as never);

    const result = await service.listMyJobs(actor as never, {});

    expect(findMany.mock.calls[0][0].select.version).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "wo-1", version: 7 });
  });
});
