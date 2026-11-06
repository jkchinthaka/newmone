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

  function make(task: ReturnType<typeof baseTask>, woStatus = "IN_PROGRESS") {
    const prisma = {
      workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo1", status: woStatus }) },
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

  it("locks tasks for the technician once the job is marked complete, but not for a manager", async () => {
    const locked = make(baseTask("u1"), "TECHNICIAN_COMPLETED");
    await expect(locked.service.setStatus("wo1", "t1", "DONE", actor("u1", "TECHNICIAN"))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(locked.service.add("wo1", { title: "x" }, actor("u1", "TECHNICIAN"))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(locked.service.remove("wo1", "t1", actor("u1", "TECHNICIAN"))).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await expect(locked.service.setStatus("wo1", "t1", "WORKING", actor("m1", "MANAGER"))).resolves.toBeDefined();
  });

  it("lets a manager update any task and rejects bad status", async () => {
    const { service } = make(baseTask("u1"));
    await expect(service.setStatus("wo1", "t1", "WORKING", actor("m1", "MANAGER"))).resolves.toBeDefined();
    await expect(service.setStatus("wo1", "t1", "NOPE", actor("m1", "MANAGER"))).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  describe("labour clock follows the person's tasks", () => {
    function withLabour(running: unknown[], stillOpen: number) {
      const task = baseTask("u1");
      const prisma = {
        workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo1", status: "IN_PROGRESS" }) },
        workOrderTask: {
          findFirst: jest.fn().mockResolvedValue(task),
          update: jest.fn().mockResolvedValue(task),
          count: jest.fn().mockResolvedValue(stillOpen)
        },
        workOrderLabourEntry: {
          findFirst: jest.fn().mockResolvedValue(running[0] ?? null),
          findMany: jest.fn().mockResolvedValue(running),
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({})
        }
      };
      return { prisma, service: new WorkOrderTasksService(prisma as never) };
    }

    it("starts a session when they start a task and nothing is running", async () => {
      const { prisma, service } = withLabour([], 1);
      await service.setStatus("wo1", "t1", "WORKING", actor("u1", "TECHNICIAN"));
      expect(prisma.workOrderLabourEntry.create).toHaveBeenCalledTimes(1);
    });

    it("does not start a second session when one is already running", async () => {
      const { prisma, service } = withLabour([{ id: "l1", startedAt: new Date() }], 1);
      await service.setStatus("wo1", "t1", "WORKING", actor("u1", "TECHNICIAN"));
      expect(prisma.workOrderLabourEntry.create).not.toHaveBeenCalled();
    });

    it("closes the session only when their last open task is done", async () => {
      const open = withLabour([{ id: "l1", startedAt: new Date(Date.now() - 600000) }], 1);
      await open.service.setStatus("wo1", "t1", "DONE", actor("u1", "TECHNICIAN"));
      expect(open.prisma.workOrderLabourEntry.update).not.toHaveBeenCalled();

      const last = withLabour([{ id: "l1", startedAt: new Date(Date.now() - 600000) }], 0);
      await last.service.setStatus("wo1", "t1", "DONE", actor("u1", "TECHNICIAN"));
      expect(last.prisma.workOrderLabourEntry.update).toHaveBeenCalledTimes(1);
    });

    it("lets a manager change a task without touching anyone's clock", async () => {
      const { prisma, service } = withLabour([], 0);
      await service.setStatus("wo1", "t1", "WORKING", actor("m1", "MANAGER"));
      expect(prisma.workOrderLabourEntry.create).not.toHaveBeenCalled();
    });
  });
});
