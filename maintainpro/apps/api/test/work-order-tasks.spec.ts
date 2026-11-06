import { BadRequestException, ForbiddenException } from "@nestjs/common";

import { WorkOrderTasksService } from "../src/modules/work-orders/work-order-tasks.service";
import { assertAllTasksDone } from "../src/modules/work-orders/work-order-tasks.util";

describe("assertAllTasksDone", () => {
  const db = (open: number) => ({ workOrderTask: { count: jest.fn().mockResolvedValue(open) } });

  it("passes when no tasks are open (or job has no tasks)", async () => {
    await expect(assertAllTasksDone(db(0), "wo1", { role: "TECHNICIAN" })).resolves.toBeUndefined();
  });

  it("blocks a technician while tasks are open", async () => {
    await expect(assertAllTasksDone(db(2), "wo1", { role: "TECHNICIAN", overrideReason: "x" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("blocks a manager without a reason, allows with a reason", async () => {
    await expect(assertAllTasksDone(db(1), "wo1", { role: "MANAGER" })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      assertAllTasksDone(db(1), "wo1", { role: "MANAGER", overrideReason: "Customer cancelled step 3" })
    ).resolves.toBeUndefined();
  });
});

describe("WorkOrderTasksService.setStatus", () => {
  const baseTask = (linkedUserId: string, status = "NOT_STARTED") => ({
    id: "t1",
    title: "Drain oil",
    status,
    sortOrder: 1,
    estimatedHours: null,
    startedAt: null,
    completedAt: null,
    timeSpentMinutes: null,
    assignees: [{ employee: { id: "e1", fullName: "Kamal", linkedUserId } }]
  });

  function make(task: ReturnType<typeof baseTask>) {
    const prisma = {
      workOrderTask: {
        findFirst: jest.fn().mockResolvedValue(task),
        update: jest.fn().mockResolvedValue(task)
      }
    };
    return { prisma, service: new WorkOrderTasksService(prisma as never) };
  }
  const actor = (sub: string, role: string) => ({ sub, email: "a@b.c", role, tenantId: "t" }) as never;

  it("lets an assigned technician mark their task done and records time", async () => {
    const { prisma, service } = make(baseTask("u1"));
    await service.setStatus("wo1", "t1", "DONE", actor("u1", "TECHNICIAN"));
    const patch = prisma.workOrderTask.update.mock.calls[0][0].data;
    expect(patch.status).toBe("DONE");
    expect(patch.completedById).toBe("u1");
    expect(patch.timeSpentMinutes).toBeGreaterThanOrEqual(1);
  });

  it("rejects a technician who is not on the task", async () => {
    const { service } = make(baseTask("u1"));
    await expect(service.setStatus("wo1", "t1", "DONE", actor("u2", "TECHNICIAN"))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("lets a manager update any task and rejects bad status", async () => {
    const { service } = make(baseTask("u1"));
    await expect(service.setStatus("wo1", "t1", "WORKING", actor("m1", "MANAGER"))).resolves.toBeDefined();
    await expect(service.setStatus("wo1", "t1", "NOPE", actor("m1", "MANAGER"))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});
