import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { OperationsController } from "../src/modules/operations/operations.controller";
import { PredictiveAiController } from "../src/modules/predictive-ai/predictive-ai.controller";
import { VehiclesController } from "../src/modules/vehicles/vehicles.controller";

describe("PermissionsGuard", () => {
  const buildContext = (user: { sub?: string; role?: string; permissions?: string[] }) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user })
      })
    } as unknown as ExecutionContext;
  };

  it("allows access when no permissions metadata exists", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn()
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    const context = buildContext({ sub: "u-1", role: "ADMIN" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("allows super admin even without explicit permission list", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.view"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn()
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    const context = buildContext({ sub: "u-1", role: "SUPER_ADMIN" });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("blocks when required permission is missing", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["audit.view"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: {
            permissions: [{ key: "vehicles.view" }]
          }
        })
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    const context = buildContext({ sub: "u-1", role: "ADMIN" });

    await expect(guard.canActivate(context)).rejects.toThrow("Missing required permission");
  });

  it("uses token permissions if present", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.edit"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn()
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    const context = buildContext({
      sub: "u-1",
      role: "ADMIN",
      permissions: ["vehicles.view", "vehicles.edit"]
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("requires operations scan permission for the phase 6 scan endpoint", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: {
            permissions: [{ key: "vehicles.view" }]
          }
        })
      }
    } as any);

    const context = {
      getHandler: () => OperationsController.prototype.scanLookup,
      getClass: () => OperationsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "u-1", role: "DRIVER" } })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow("operations.scan_lookup");
  });

  it("requires predictive insights permission for the field insights endpoint", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: {
            permissions: [{ key: "operations.scan_lookup" }]
          }
        })
      }
    } as any);

    const context = {
      getHandler: () => PredictiveAiController.prototype.fieldInsights,
      getClass: () => PredictiveAiController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "u-1", role: "DRIVER" } })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow("predictive_insights.view");
  });

  it("accepts the legacy vehicles.operate permission for gate-out compatibility", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: { findUnique: jest.fn() }
    } as any);

    const context = {
      getHandler: () => VehiclesController.prototype.gateOut,
      getClass: () => VehiclesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: "u-1",
            role: "MANAGER",
            permissions: ["vehicles.operate"]
          }
        })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("allows security officers with fine-grained gate permission", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: { findUnique: jest.fn() }
    } as any);

    const context = {
      getHandler: () => VehiclesController.prototype.gateOut,
      getClass: () => VehiclesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            sub: "u-1",
            role: "SECURITY_OFFICER",
            permissions: ["gate.out.create"]
          }
        })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
