import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { RolesGuard } from "../src/common/guards/roles.guard";
import { requestContext } from "../src/common/context/request-context";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";
import {
  ADMIN_ROLES_PERMISSIONS_MATRIX_FIELDS,
  ADMIN_ROLES_PERMISSIONS_SENSITIVE_FIELDS,
  AdminRolesPermissionsMatrix,
  AdminRolesService
} from "../src/modules/admin/admin-roles.service";

const samplePermissions = [
  { id: "perm-1", key: "users.view", description: "View users" },
  { id: "perm-2", key: "users.edit", description: "Edit users" }
];

const sampleRoles = [
  {
    id: "role-admin",
    name: RoleName.ADMIN,
    tenantId: "tenant-a",
    tenant: { id: "tenant-a", name: "Tenant A" },
    permissions: [{ key: "users.view" }, { key: "users.edit" }]
  },
  {
    id: "role-viewer",
    name: RoleName.VIEWER,
    tenantId: "tenant-a",
    tenant: { id: "tenant-a", name: "Tenant A" },
    permissions: [{ key: "users.view" }]
  }
];

const createPrismaMock = () => ({
  permission: {
    findMany: jest.fn().mockResolvedValue(samplePermissions)
  },
  role: {
    findMany: jest.fn().mockResolvedValue(sampleRoles)
  }
});

describe("Admin roles permissions matrix", () => {
  it("returns sanitized tenant-scoped matrix for ADMIN", async () => {
    const prisma = createPrismaMock();
    const service = new AdminRolesService(prisma as any);

    const matrix = await requestContext.run(
      {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/roles-permissions"
      },
      () => service.findRolesPermissionsMatrixForReview()
    );

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-a" }
      })
    );

    expect(matrix.scope).toBe("tenant");
    expect(matrix.roles).toHaveLength(2);
    expect(matrix.permissionGroups.some((group) => group.module === "users")).toBe(true);
    expect(matrix.coverage["users.view"]).toEqual(expect.arrayContaining(["role-admin", "role-viewer"]));
    expect(matrix.roles[0]?.permissionCount).toBeGreaterThan(0);
    expect(Object.keys(matrix).sort()).toEqual([...ADMIN_ROLES_PERMISSIONS_MATRIX_FIELDS].sort());

    for (const field of ADMIN_ROLES_PERMISSIONS_SENSITIVE_FIELDS) {
      assertMatrixObjectHasNoSensitiveField(matrix, field);
    }
  });

  it("returns cross-tenant matrix for SUPER_ADMIN without tenant filter", async () => {
    const prisma = createPrismaMock();
    const service = new AdminRolesService(prisma as any);

    const matrix = await requestContext.run(
      {
        actorId: "super-1",
        actorEmail: "super@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/roles-permissions"
      },
      () => service.findRolesPermissionsMatrixForReview()
    );

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {}
      })
    );
    expect(matrix.scope).toBe("cross-tenant");
    expect((matrix as AdminRolesPermissionsMatrix).roles[0]?.tenantName).toBe("Tenant A");
  });

  it("blocks non-admin roles from the admin roles matrix endpoint via RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => AdminAccessController.prototype.listRolesPermissionsMatrix,
      getClass: () => AdminAccessController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "VIEWER" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});

function assertMatrixObjectHasNoSensitiveField(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertMatrixObjectHasNoSensitiveField(entry, field));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  expect(Object.prototype.hasOwnProperty.call(value, field)).toBe(false);
  Object.values(value).forEach((entry) => assertMatrixObjectHasNoSensitiveField(entry, field));
}
