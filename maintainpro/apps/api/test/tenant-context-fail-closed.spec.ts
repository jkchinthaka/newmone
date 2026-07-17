import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { SKIP_TENANT_CONTEXT_KEY } from "../src/common/decorators/skip-tenant-context.decorator";
import { PLATFORM_SCOPED_KEY } from "../src/common/decorators/tenant-scope.decorator";
import { requireTenantId, tenantWhere } from "../src/common/utils/tenant-scope.util";
import { requestContext } from "../src/common/context/request-context";
import { TenantContextGuard } from "../src/modules/tenancy/tenant-context.guard";

function mockContext(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as never;
}

describe("TenantContextGuard fail-closed", () => {
  const prisma = {
    tenantMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn()
    },
    tenant: {
      findUnique: jest.fn()
    }
  };

  function buildGuard(meta: Record<string, boolean | undefined> = {}) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => meta[key])
    } as unknown as Reflector;
    return new TenantContextGuard(reflector, prisma as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects authenticated tenant-scoped requests without resolvable tenant", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);
    const guard = buildGuard({});
    const request = {
      headers: {},
      user: { sub: "u1", role: RoleName.TECHNICIAN, tenantId: null }
    };

    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });

  it("allows public routes without tenant", async () => {
    const guard = buildGuard({ [IS_PUBLIC_KEY]: true });
    const request = { headers: {}, user: undefined };
    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
  });

  it("allows platform-scoped SUPER_ADMIN without tenant", async () => {
    const guard = buildGuard({ [PLATFORM_SCOPED_KEY]: true });
    const request = {
      headers: {},
      user: { sub: "sa", role: RoleName.SUPER_ADMIN, tenantId: null }
    };
    await expect(guard.canActivate(mockContext(request))).resolves.toBe(true);
    expect(request.user.tenantId).toBeNull();
  });

  it("rejects platform-scoped non-super-admin", async () => {
    const guard = buildGuard({ [PLATFORM_SCOPED_KEY]: true });
    const request = {
      headers: {},
      user: { sub: "a1", role: RoleName.ADMIN, tenantId: null }
    };
    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(/SUPER_ADMIN/);
  });

  it("SkipTenantContext still requires tenant for non-super-admin", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue(null);
    const guard = buildGuard({ [SKIP_TENANT_CONTEXT_KEY]: true });
    const request = {
      headers: {},
      user: { sub: "u1", role: RoleName.MANAGER, tenantId: null }
    };
    await expect(guard.canActivate(mockContext(request))).rejects.toThrow(ForbiddenException);
  });
});

describe("requireTenantId helper", () => {
  it("throws when request context has no tenant", () => {
    expect(() =>
      requestContext.run(
        {
          actorId: "u1",
          actorEmail: "u@test.com",
          actorRole: RoleName.TECHNICIAN,
          tenantId: null,
          module: "test",
          ipAddress: null,
          userAgent: null,
          requestPath: null
        },
        () => requireTenantId()
      )
    ).toThrow(ForbiddenException);
  });

  it("returns tenant where fragment when present", () => {
    const where = requestContext.run(
      {
        actorId: "u1",
        actorEmail: "u@test.com",
        actorRole: RoleName.TECHNICIAN,
        tenantId: "tenant-a",
        module: "test",
        ipAddress: null,
        userAgent: null,
        requestPath: null
      },
      () => tenantWhere()
    );
    expect(where).toEqual({ tenantId: "tenant-a" });
  });
});