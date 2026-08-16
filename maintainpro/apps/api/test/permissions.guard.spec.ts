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

  const activeUser = (overrides?: {
    roleName?: string;
    permissions?: string[];
    isActive?: boolean;
    lockedUntil?: Date | null;
  }) => ({
    id: "u-1",
    isActive: overrides?.isActive ?? true,
    lockedUntil: overrides?.lockedUntil ?? null,
    role: {
      name: overrides?.roleName ?? "ADMIN",
      permissions: (overrides?.permissions ?? []).map((key) => ({ key }))
    }
  });

  it("allows access when no permissions metadata exists", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined)
    } as unknown as Reflector;

    const prisma = { user: { findUnique: jest.fn() } } as any;
    const guard = new PermissionsGuard(reflector, prisma);
    await expect(guard.canActivate(buildContext({ sub: "u-1", role: "ADMIN" }))).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("allows SUPER_ADMIN from DB role even without permission list", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.view"])
    } as unknown as Reflector;

    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(activeUser({ roleName: "SUPER_ADMIN" })) }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(guard.canActivate(buildContext({ sub: "u-1", role: "VIEWER" }))).resolves.toBe(true);
  });

  it("does not trust JWT SUPER_ADMIN when DB role is not SUPER_ADMIN", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.edit"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ roleName: "VIEWER", permissions: ["vehicles.view"] })
        )
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(
      guard.canActivate(buildContext({ sub: "u-1", role: "SUPER_ADMIN", permissions: ["*"] }))
    ).rejects.toThrow("Missing required permission");
  });

  it("blocks when required permission is missing in DB", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["audit.view"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ permissions: ["vehicles.view"] })
        )
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(guard.canActivate(buildContext({ sub: "u-1", role: "ADMIN" }))).rejects.toThrow(
      "Missing required permission"
    );
  });

  it("MP-006: ignores stale JWT permissions and uses DB", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.edit"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ permissions: ["vehicles.view", "vehicles.edit"] })
        )
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(
      guard.canActivate(
        buildContext({
          sub: "u-1",
          role: "ADMIN",
          permissions: ["vehicles.view", "vehicles.edit", "audit.view"]
        })
      )
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it("MP-006: in production, missing DB user is fail-closed even with JWT permissions", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(["vehicles.view"])
      } as unknown as Reflector;
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null) }
      } as any;
      const guard = new PermissionsGuard(reflector, prisma);
      await expect(
        guard.canActivate(
          buildContext({ sub: "u-missing", role: "ADMIN", permissions: ["vehicles.view"] })
        )
      ).rejects.toThrow("Authenticated user not found");
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("MP-006: test harness allows x-test-permissions when DB user is absent", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(["vehicles.view"])
      } as unknown as Reflector;
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null) }
      } as any;
      const guard = new PermissionsGuard(reflector, prisma);
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { "x-test-permissions": "vehicles.view" },
            user: { sub: "u-harness", role: "ADMIN", permissions: ["vehicles.view"] }
          })
        })
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("MP-006: revoked DB permission denies on next request (no cache)", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.edit"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser({ permissions: ["vehicles.view"] }))
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(
      guard.canActivate(
        buildContext({
          sub: "u-revoked",
          role: "ADMIN",
          permissions: ["vehicles.view", "vehicles.edit"]
        })
      )
    ).rejects.toThrow("Missing required permission");
  });

  it("MP-006: disabled users cannot authorize from cache/JWT", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["vehicles.view"])
    } as unknown as Reflector;

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ isActive: false, permissions: ["vehicles.view"] })
        )
      }
    } as any;

    const guard = new PermissionsGuard(reflector, prisma);
    await expect(guard.canActivate(buildContext({ sub: "u-1", role: "ADMIN" }))).rejects.toThrow(
      "disabled"
    );
  });

  it("requires operations scan permission for the phase 6 scan endpoint", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: {
        findUnique: jest.fn().mockResolvedValue(activeUser({ permissions: ["vehicles.view"] }))
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
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ permissions: ["operations.scan_lookup"] })
        )
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
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ roleName: "MANAGER", permissions: ["vehicles.operate"] })
        )
      }
    } as any);

    const context = {
      getHandler: () => VehiclesController.prototype.gateOut,
      getClass: () => VehiclesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: "u-1", role: "MANAGER", permissions: ["vehicles.operate"] }
        })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("allows security officers with fine-grained gate permission", async () => {
    const guard = new PermissionsGuard(new Reflector(), {
      user: {
        findUnique: jest.fn().mockResolvedValue(
          activeUser({ roleName: "SECURITY_OFFICER", permissions: ["gate.out.create"] })
        )
      }
    } as any);

    const context = {
      getHandler: () => VehiclesController.prototype.gateOut,
      getClass: () => VehiclesController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { sub: "u-1", role: "SECURITY_OFFICER", permissions: ["gate.out.create"] }
        })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
