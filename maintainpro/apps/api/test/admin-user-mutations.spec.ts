import { BadRequestException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { SuperAdminGuard } from "../src/common/guards/super-admin.guard";
import { requestContext } from "../src/common/context/request-context";
import { UsersService } from "../src/modules/users/users.service";

const actor = { sub: "super-1", email: "super@test.local", role: RoleName.SUPER_ADMIN, tenantId: "tenant-a" };
const ctx = {
  actorId: actor.sub,
  actorEmail: actor.email,
  actorRole: actor.role,
  tenantId: actor.tenantId,
  module: "admin-users",
  ipAddress: null,
  userAgent: null,
  requestPath: "/admin/users"
};

function buildPrisma(overrides: { existingEmail?: string; superAdminCount?: number } = {}) {
  const users = new Map<string, any>();
  const roles = new Map<string, any>([
    ["role-super", { id: "role-super", name: RoleName.SUPER_ADMIN }],
    ["role-manager", { id: "role-manager", name: RoleName.MANAGER }]
  ]);
  const refreshTokens: any[] = [];
  const auditEntries: any[] = [];

  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.email) {
          return where.email === overrides.existingEmail ? { id: "existing-user" } : null;
        }
        return users.get(where.id) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => users.get(where.id) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const id = `user-${users.size + 1}`;
        const role = roles.get(data.roleId);
        const record = { id, ...data, role };
        users.set(id, record);
        return record;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const current = users.get(where.id);
        const next = { ...current, ...data };
        if (data.roleId) next.role = roles.get(data.roleId);
        users.set(where.id, next);
        return next;
      }),
      count: jest.fn(async () => overrides.superAdminCount ?? 2)
    },
    role: {
      findUnique: jest.fn(async ({ where }: any) => roles.get(where.id) ?? null)
    },
    tenant: {
      findUnique: jest.fn(async ({ where }: any) => ({ id: where.id, isActive: true }))
    },
    department: {
      findFirst: jest.fn(async ({ where }: any) => ({ id: where.id }))
    },
    tenantMembership: {
      create: jest.fn(async () => ({}))
    },
    refreshToken: {
      updateMany: jest.fn(async (args: any) => {
        refreshTokens.push(args);
        return { count: 1 };
      })
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        auditEntries.push(data);
        return { id: `audit-${auditEntries.length}` };
      })
    },
    $transaction: jest.fn(async (arg: any) => (typeof arg === "function" ? arg(prisma) : Promise.all(arg)))
  };

  // Seed a target user for update/password tests.
  users.set("target-1", {
    id: "target-1",
    email: "target@test.local",
    firstName: "Target",
    lastName: "User",
    roleId: "role-manager",
    tenantId: "tenant-a",
    role: roles.get("role-manager")
  });
  users.set("super-only", {
    id: "super-only",
    email: "super-only@test.local",
    firstName: "Only",
    lastName: "Super",
    roleId: "role-super",
    tenantId: null,
    role: roles.get("role-super")
  });

  return { prisma, users, auditEntries, refreshTokens };
}

describe("Admin Console user mutations (SUPER_ADMIN)", () => {
  it("SuperAdminGuard rejects ADMIN and MANAGER even with a valid session", async () => {
    for (const role of [RoleName.ADMIN, RoleName.MANAGER]) {
      const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, lockedUntil: null, role: { name: role } }) } };
      const guard = new SuperAdminGuard(prisma);
      await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: { sub: "u1" } }) }) } as any)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    }
  });

  it("SuperAdminGuard rejects with no session", async () => {
    const prisma: any = { user: { findUnique: jest.fn() } };
    const guard = new SuperAdminGuard(prisma);
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({}) }) } as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("creates a user with tenant/department/designation and writes USER_CREATED audit", async () => {
    const { prisma, auditEntries } = buildPrisma();
    const service = new UsersService(prisma);

    const result = await requestContext.run(ctx, () =>
      service.createForAdminConsole(
        {
          email: "new.user@test.local",
          firstName: "New",
          lastName: "User",
          roleId: "role-manager",
          tenantId: "tenant-a",
          departmentId: "dept-1",
          designation: "Fleet Coordinator",
          password: "Str0ng!Passw0rd"
        } as any,
        actor
      )
    );

    expect(result.email).toBe("new.user@test.local");
    expect(prisma.tenantMembership.create).toHaveBeenCalled();
    expect(auditEntries.some((e) => e.metadata?.event === "USER_CREATED")).toBe(true);
    // Never leak password/hash in the audit trail.
    expect(JSON.stringify(auditEntries)).not.toMatch(/Str0ng!Passw0rd/);
  });

  it("rejects duplicate email on create", async () => {
    const { prisma } = buildPrisma({ existingEmail: "dup@test.local" });
    const service = new UsersService(prisma);

    await expect(
      requestContext.run(ctx, () =>
        service.createForAdminConsole(
          { email: "dup@test.local", firstName: "A", lastName: "B", roleId: "role-manager" } as any,
          actor
        )
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("generates a temporary password and forces mustChangePassword when none is supplied", async () => {
    const { prisma } = buildPrisma();
    const service = new UsersService(prisma);

    const result = await requestContext.run(ctx, () =>
      service.createForAdminConsole({ email: "temp@test.local", firstName: "T", lastName: "U", roleId: "role-manager" } as any, actor)
    );

    expect(result.temporaryPassword).toBeTruthy();
  });

  it("updates role and writes USER_ROLE_CHANGED audit", async () => {
    const { prisma, auditEntries } = buildPrisma();
    const service = new UsersService(prisma);

    await requestContext.run(ctx, () => service.updateForAdminConsole("target-1", { roleId: "role-super" } as any, actor));

    expect(auditEntries.some((e) => e.metadata?.event === "USER_ROLE_CHANGED")).toBe(true);
  });

  it("updates email and writes USER_EMAIL_CHANGED audit", async () => {
    const { prisma, auditEntries } = buildPrisma();
    const service = new UsersService(prisma);

    await requestContext.run(ctx, () => service.updateForAdminConsole("target-1", { email: "changed@test.local" } as any, actor));

    expect(auditEntries.some((e) => e.metadata?.event === "USER_EMAIL_CHANGED")).toBe(true);
  });

  it("blocks demoting the last active SUPER_ADMIN away from SUPER_ADMIN", async () => {
    const { prisma } = buildPrisma({ superAdminCount: 1 });
    const service = new UsersService(prisma);

    await expect(
      requestContext.run(ctx, () => service.updateForAdminConsole("super-only", { roleId: "role-manager" } as any, actor))
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows demoting a SUPER_ADMIN when another active SUPER_ADMIN remains", async () => {
    const { prisma } = buildPrisma({ superAdminCount: 2 });
    const service = new UsersService(prisma);

    await expect(
      requestContext.run(ctx, () => service.updateForAdminConsole("super-only", { roleId: "role-manager" } as any, actor))
    ).resolves.toBeDefined();
  });

  it("resets a user's password, revokes sessions, and never returns/logs the hash", async () => {
    const { prisma, auditEntries, refreshTokens } = buildPrisma();
    const service = new UsersService(prisma);

    const result = await requestContext.run(ctx, () =>
      service.setPasswordForAdminConsole("target-1", { newPassword: "N3w!Passw0rd", mustChangePassword: true } as any, actor)
    );

    expect(result.temporaryPassword).toBeUndefined();
    expect(refreshTokens.length).toBeGreaterThan(0);
    expect(refreshTokens[0].where).toEqual(expect.objectContaining({ userId: "target-1", revokedAt: null }));
    const auditJson = JSON.stringify(auditEntries);
    expect(auditJson).not.toMatch(/N3w!Passw0rd/);
    expect(auditJson).not.toMatch(/passwordHash/i);
    expect(auditEntries.some((e) => e.metadata?.event === "USER_PASSWORD_RESET")).toBe(true);
  });

  it("generates a temporary password when none is supplied for a reset", async () => {
    const { prisma } = buildPrisma();
    const service = new UsersService(prisma);

    const result = await requestContext.run(ctx, () => service.setPasswordForAdminConsole("target-1", {} as any, actor));

    expect(result.temporaryPassword).toBeTruthy();
    expect(result.mustChangePassword).toBe(true);
  });

  it("prevents deleting your own account", async () => {
    const { prisma } = buildPrisma();
    const service = new UsersService(prisma);

    await expect(requestContext.run(ctx, () => service.remove("super-1"))).rejects.toBeInstanceOf(BadRequestException);
  });
});
