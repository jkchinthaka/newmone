import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { WorkOrdersController } from "../src/modules/work-orders/work-orders.controller";

const CREATE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"] as const;

function rolesContext(handler: (...args: never[]) => unknown, role: string): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => WorkOrdersController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: "user-1", role } })
    })
  } as unknown as ExecutionContext;
}

describe("Work order create RBAC (API alignment)", () => {
  const rolesGuard = new RolesGuard(new Reflector());

  it("POST create allows manager/admin create roles", () => {
    for (const role of CREATE_ROLES) {
      expect(
        rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.create, role))
      ).toBe(true);
    }
  });

  it("POST create blocks technician/mechanic/supervisor", () => {
    for (const role of ["TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER"] as const) {
      expect(() =>
        rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.create, role))
      ).toThrow(ForbiddenException);
    }
  });

  it("GET job-categories matches create roles (not technician)", () => {
    const metaRoles = Reflect.getMetadata(ROLES_KEY, WorkOrdersController.prototype.listJobCategories) as string[];
    const createMetaRoles = Reflect.getMetadata(ROLES_KEY, WorkOrdersController.prototype.create) as string[];
    expect(metaRoles).toEqual(createMetaRoles);
    expect(metaRoles).not.toContain("TECHNICIAN");
    expect(metaRoles).not.toContain("MECHANIC");
    expect(metaRoles).not.toContain("SUPERVISOR");

    expect(
      rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.listJobCategories, "MANAGER"))
    ).toBe(true);
    expect(() =>
      rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.listJobCategories, "TECHNICIAN"))
    ).toThrow(ForbiddenException);
  });

  it("POST create and job-categories both require work_orders.manage", () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WorkOrdersController.prototype.create)).toEqual([
      "work_orders.manage"
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, WorkOrdersController.prototype.listJobCategories)).toEqual([
      "work_orders.manage"
    ]);
  });

  it("technician can still access allowed WO read/update entry points", () => {
    expect(
      rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.findOne, "TECHNICIAN"))
    ).toBe(true);
    expect(
      rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.updateStatus, "TECHNICIAN"))
    ).toBe(true);
    expect(
      rolesGuard.canActivate(rolesContext(WorkOrdersController.prototype.startWorkOrder, "TECHNICIAN"))
    ).toBe(true);
  });

  it("PermissionsGuard rejects create when work_orders.manage is missing (non-super-admin)", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          isActive: true,
          lockedUntil: null,
          role: {
            name: "MANAGER",
            permissionLinks: [{ permission: { key: "work_orders.view" } }]
          }
        })
      }
    };
    const guard = new PermissionsGuard(new Reflector(), prisma as never);
    await expect(
      guard.canActivate(rolesContext(WorkOrdersController.prototype.create, "MANAGER"))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("PermissionsGuard allows create when manager has work_orders.manage", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user-1",
          isActive: true,
          lockedUntil: null,
          role: {
            name: "MANAGER",
            permissionLinks: [{ permission: { key: "work_orders.manage" } }]
          }
        })
      }
    };
    const guard = new PermissionsGuard(new Reflector(), prisma as never);
    await expect(
      guard.canActivate(rolesContext(WorkOrdersController.prototype.create, "MANAGER"))
    ).resolves.toBe(true);
  });
});
