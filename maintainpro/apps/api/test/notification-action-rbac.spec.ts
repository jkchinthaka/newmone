import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext } from "../src/common/context/request-context";
import { NotificationsService } from "../src/modules/notifications/notifications.service";

/** Notification buttons that change jobs need the Jobs page's role and permission, and same-company ids. */
describe("notification actions are not self-service for job changes", () => {
  const notification = { id: "n1", userId: "u1", referenceType: "WorkOrder", referenceId: "wo1", title: "T", message: "M", priority: "WARNING", dueAt: null };

  function build(opts: { permissions?: string[]; found?: Record<string, boolean> } = {}) {
    const service = Object.create(NotificationsService.prototype) as any;
    const found = { asset: true, vehicle: true, user: true, workOrder: true, ...(opts.found ?? {}) };
    service.requireNotification = jest.fn().mockResolvedValue(notification);
    service.acknowledge = jest.fn().mockResolvedValue({ id: "n1" });
    service.createNotification = jest.fn();
    service.nextWorkOrderNumber = jest.fn().mockResolvedValue("JO-1");
    service.prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: { permissionLinks: (opts.permissions ?? []).map((key) => ({ permission: { key } })) } }),
        findFirst: jest.fn().mockResolvedValue(found.user ? { id: "x" } : null)
      },
      asset: { findFirst: jest.fn().mockResolvedValue(found.asset ? { id: "a" } : null) },
      vehicle: { findFirst: jest.fn().mockResolvedValue(found.vehicle ? { id: "v" } : null) },
      workOrder: {
        findFirst: jest.fn().mockResolvedValue(found.workOrder ? { id: "wo1" } : null),
        update: jest.fn().mockResolvedValue({ id: "wo1", woNumber: "JO-1", dueDate: null }),
        create: jest.fn().mockResolvedValue({ id: "wo2", woNumber: "JO-2", dueDate: null })
      }
    };
    return service as {
      prisma: any;
      acknowledge: jest.Mock;
      runAction: (userId: string, id: string, actorId: string, action: unknown, role?: string) => Promise<unknown>;
    };
  }

  const run = <T,>(fn: () => Promise<T>) => requestContext.run({ tenantId: "t1" } as never, fn);

  it.each(["VIEWER", "DRIVER", "TECHNICIAN", "SECURITY_OFFICER"])("%s cannot assign, schedule or create jobs from a notification", async (role) => {
    const service = build({ permissions: ["work_orders.manage", "work_orders.assign"] });
    for (const action of ["ASSIGN_USER", "SCHEDULE_TASK", "CREATE_WORK_ORDER"] as const) {
      await expect(run(() => service.runAction("u1", "n1", "u1", { action, payload: { userId: "u2" } }, role))).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(service.prisma.workOrder.update).not.toHaveBeenCalled();
    expect(service.prisma.workOrder.create).not.toHaveBeenCalled();
  });

  it("any role can still acknowledge its own notification", async () => {
    const service = build();
    await run(() => service.runAction("u1", "n1", "u1", { action: "ACKNOWLEDGE" }, "VIEWER"));
    expect(service.acknowledge).toHaveBeenCalled();
  });

  it("a manager with no job permission is refused; with the assign permission the assignment goes through", async () => {
    await expect(run(() => build({ permissions: ["inventory.view"] }).runAction("u1", "n1", "u1", { action: "ASSIGN_USER", payload: { userId: "u2" } }, "MANAGER"))).rejects.toBeInstanceOf(ForbiddenException);
    const ok = build({ permissions: ["work_orders.assign"] });
    await run(() => ok.runAction("u1", "n1", "u1", { action: "ASSIGN_USER", payload: { userId: "u2" } }, "MANAGER"));
    expect(ok.prisma.workOrder.update).toHaveBeenCalled();
  });

  it("admin keeps access, and an assignee from another company is refused", async () => {
    const admin = build();
    await run(() => admin.runAction("u1", "n1", "u1", { action: "ASSIGN_USER", payload: { userId: "u2" } }, "ADMIN"));
    expect(admin.prisma.workOrder.update).toHaveBeenCalled();
    const other = build({ found: { user: false } });
    await expect(run(() => other.runAction("u1", "n1", "u1", { action: "ASSIGN_USER", payload: { userId: "u9" } }, "ADMIN"))).rejects.toBeInstanceOf(NotFoundException);
    expect(other.prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("a new job cannot point at another company's asset, vehicle or technician", async () => {
    for (const found of [{ asset: false }, { vehicle: false }, { user: false }] as Array<Record<string, boolean>>) {
      const service = build({ found });
      await expect(
        run(() => service.runAction("u1", "n1", "u1", { action: "CREATE_WORK_ORDER", payload: { assetId: "a9", vehicleId: "v9", technicianId: "u9" } }, "ADMIN"))
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(service.prisma.workOrder.create).not.toHaveBeenCalled();
    }
  });
});
