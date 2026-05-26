import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PermissionsGuard } from "../src/common/guards/permissions.guard";

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
});
