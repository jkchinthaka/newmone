import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";
import { TenancyService } from "../src/modules/tenancy/tenancy.service";
import { TenantContextGuard } from "../src/modules/tenancy/tenant-context.guard";
import {
  TENANT_EFFECTIVE_ROLE_KEY,
  effectiveRoleForTenant,
  roleNameForMembership
} from "../src/modules/tenancy/tenant-effective-role";
import { SKIP_TENANT_CONTEXT_KEY } from "../src/common/decorators/skip-tenant-context.decorator";

function context(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request })
  } as never;
}

const reflectorWith = (meta: Record<string, unknown>) =>
  ({ getAllAndOverride: jest.fn((key: string) => meta[key]) }) as unknown as Reflector;

describe("effectiveRoleForTenant", () => {
  it("uses the global role in the home tenant and for SUPER_ADMIN", () => {
    expect(
      effectiveRoleForTenant({ globalRole: "ADMIN", homeTenantId: "a", activeTenantId: "a", membershipRole: "MEMBER" })
    ).toMatchObject({ roleName: "ADMIN", usesGlobalRole: true });
    expect(
      effectiveRoleForTenant({ globalRole: "SUPER_ADMIN", homeTenantId: "a", activeTenantId: "b", membershipRole: null })
    ).toMatchObject({ roleName: "SUPER_ADMIN", usesGlobalRole: true });
  });

  it("caps the role at the membership role outside the home tenant", () => {
    expect(
      effectiveRoleForTenant({ globalRole: "ADMIN", homeTenantId: "a", activeTenantId: "b", membershipRole: "MEMBER" })
    ).toMatchObject({ roleName: RoleName.TECHNICIAN, usesGlobalRole: false, tenantId: "b" });
    expect(roleNameForMembership("BILLING")).toBe(RoleName.MANAGER);
    expect(roleNameForMembership("")).toBe(RoleName.VIEWER);
  });
});

describe("tenant guards apply the membership role", () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    tenantMembership: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
    role: { findFirst: jest.fn() }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      isActive: true,
      lockedUntil: null,
      tenantId: "tenant-home",
      role: { name: RoleName.ADMIN, permissionLinks: [{ permission: { key: "users.manage" } }] }
    });
  });

  it("a global ADMIN who is a MEMBER of another tenant acts as TECHNICIAN there", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue({ tenantId: "tenant-b", membershipRole: "MEMBER" });
    const request: Record<string, any> = {
      headers: { "x-tenant-id": "tenant-b" },
      user: { sub: "u1", role: RoleName.ADMIN, tenantId: "tenant-home" }
    };

    await new TenantContextGuard(reflectorWith({}), prisma as never).canActivate(context(request));
    expect(request.user.role).toBe(RoleName.TECHNICIAN);
    expect(request[TENANT_EFFECTIVE_ROLE_KEY]).toMatchObject({ roleName: RoleName.TECHNICIAN, usesGlobalRole: false });

    const roles = new RolesGuard(reflectorWith({ roles: ["ADMIN"] }) as never, prisma as never);
    await expect(roles.canActivate(context(request))).rejects.toThrow(ForbiddenException);

    prisma.role.findFirst.mockResolvedValueOnce({
      name: RoleName.TECHNICIAN,
      permissionLinks: [{ permission: { key: "work_orders.view_own" } }]
    });
    const permissions = new PermissionsGuard(reflectorWith({ permissions: ["users.manage"] }), prisma as never);
    await expect(permissions.canActivate(context(request))).rejects.toThrow(/users.manage/);
    expect(prisma.role.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: RoleName.TECHNICIAN, tenantId: "tenant-b" } })
    );
  });

  it("keeps the global role in the home tenant", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue({ tenantId: "tenant-home", membershipRole: "OWNER" });
    const request: Record<string, any> = {
      headers: {},
      user: { sub: "u1", role: RoleName.ADMIN, tenantId: "tenant-home" }
    };

    await new TenantContextGuard(reflectorWith({}), prisma as never).canActivate(context(request));
    expect(request.user.role).toBe(RoleName.ADMIN);
    const permissions = new PermissionsGuard(reflectorWith({ permissions: ["users.manage"] }), prisma as never);
    await expect(permissions.canActivate(context(request))).resolves.toBe(true);
    expect(prisma.role.findFirst).not.toHaveBeenCalled();
  });

  it("skip-tenant routes fall back to the home tenant when a stale claim lost its membership", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);
    const request: Record<string, any> = {
      headers: {},
      user: { sub: "u1", role: RoleName.ADMIN, tenantId: "tenant-gone" }
    };

    await new TenantContextGuard(reflectorWith({ [SKIP_TENANT_CONTEXT_KEY]: true }), prisma as never).canActivate(
      context(request)
    );
    expect(request.tenantId).toBe("tenant-home");
    expect(request.user.role).toBe(RoleName.ADMIN);
  });
});

describe("TenancyService.switchTenant", () => {
  it("does not persist the switched tenant on the user and carries the session version", async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          email: "u@example.com",
          tenantId: "tenant-home",
          sessionVersion: 5,
          role: { name: RoleName.ADMIN }
        }),
        update: jest.fn()
      },
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: "tenant-b", name: "B", slug: "b", isActive: true }) },
      tenantMembership: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ membershipRole: "MEMBER" })
      }
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue("token") };
    const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback ?? "secret") };
    const service = new TenancyService(prisma as never, jwt as never, config as never);

    await service.switchTenant("u1", "tenant-b");
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ tenantId: "tenant-b", sv: 5 });
  });
});
