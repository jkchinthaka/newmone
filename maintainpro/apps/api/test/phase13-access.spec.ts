import { ForbiddenException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RolesGuard } from "../src/common/guards/roles.guard";
import { assertRoleAssignmentAllowed } from "../src/modules/users/role-assignment";

describe("role assignment rules", () => {
  it("stops an administrator from assigning the super admin role", () => {
    expect(() =>
      assertRoleAssignmentAllowed({
        actorRole: "ADMIN",
        nextRoleName: "SUPER_ADMIN"
      })
    ).toThrow(ForbiddenException);
  });

  it("stops a manager from assigning the admin role", () => {
    expect(() =>
      assertRoleAssignmentAllowed({
        actorRole: "MANAGER",
        nextRoleName: "ADMIN"
      })
    ).toThrow(ForbiddenException);
  });

  it("stops a user from changing their own role", () => {
    expect(() =>
      assertRoleAssignmentAllowed({
        actorRole: "ADMIN",
        actorId: "user-1",
        targetUserId: "user-1",
        currentRoleName: "ADMIN",
        nextRoleName: "MANAGER"
      })
    ).toThrow(/own role/);
  });

  it("allows a super admin to assign the super admin role to someone else", () => {
    expect(() =>
      assertRoleAssignmentAllowed({
        actorRole: "SUPER_ADMIN",
        actorId: "user-1",
        targetUserId: "user-2",
        currentRoleName: "TECHNICIAN",
        nextRoleName: "SUPER_ADMIN"
      })
    ).not.toThrow();
  });
});

describe("RolesGuard database role", () => {
  it("uses the current database role instead of a stale token role", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["ADMIN"])
    } as unknown as Reflector;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          lockedUntil: null,
          role: { name: "TECHNICIAN" }
        })
      }
    };
    const guard = new RolesGuard(reflector, prisma as never);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: "user-1", role: "ADMIN" } })
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
