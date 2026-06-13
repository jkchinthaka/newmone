import { RoleName } from "@prisma/client";

import {
  PUBLIC_PERMISSION_RESPONSE_FIELDS,
  PUBLIC_ROLE_RESPONSE_FIELDS,
  ROLES_LEGACY_SENSITIVE_FIELDS,
  RolesService
} from "../src/modules/roles/roles.service";

const samplePermissionDb = {
  id: "perm-1",
  key: "users.view",
  description: "View users",
  roleIds: ["role-admin"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  roles: [{ id: "role-admin", name: RoleName.ADMIN }]
};

const sampleRoleDb = {
  id: "role-admin",
  name: RoleName.ADMIN,
  tenantId: "tenant-a",
  permissionIds: ["perm-1", "perm-2"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  permissions: [
    { id: "perm-1", key: "users.view", description: "View users", roleIds: ["role-admin"] },
    { id: "perm-2", key: "users.edit", description: "Edit users", roleIds: ["role-admin"] }
  ],
  users: [{ id: "user-1" }]
};

const createPrismaMock = () => ({
  role: {
    findMany: jest.fn().mockResolvedValue([sampleRoleDb]),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  permission: {
    findMany: jest.fn().mockResolvedValue([samplePermissionDb])
  }
});

describe("Legacy roles API hardening", () => {
  it("returns allowlisted GET /roles rows without raw relation payloads", async () => {
    const prisma = createPrismaMock();
    const service = new RolesService(prisma as any);

    const rows = await service.findAll();

    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          permissions: {
            select: { id: true, key: true, description: true },
            orderBy: { key: "asc" }
          }
        })
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual([...PUBLIC_ROLE_RESPONSE_FIELDS].sort());
    expect(row.permissionCount).toBe(2);
    expect(row.permissions[0]?.module).toBe("users");
    expect(Object.keys(row.permissions[0] ?? {}).sort()).toEqual([...PUBLIC_PERMISSION_RESPONSE_FIELDS].sort());

    for (const field of ROLES_LEGACY_SENSITIVE_FIELDS) {
      assertObjectTreeHasNoSensitiveField(row, field);
    }
  });

  it("returns allowlisted GET /roles/permissions rows without role relation payloads", async () => {
    const prisma = createPrismaMock();
    const service = new RolesService(prisma as any);

    const rows = await service.permissions();

    expect(prisma.permission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, key: true, description: true }
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual([...PUBLIC_PERMISSION_RESPONSE_FIELDS].sort());
    expect(row.module).toBe("users");

    for (const field of ROLES_LEGACY_SENSITIVE_FIELDS) {
      assertObjectTreeHasNoSensitiveField(row, field);
    }
  });
});

function assertObjectTreeHasNoSensitiveField(value: unknown, field: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => assertObjectTreeHasNoSensitiveField(entry, field));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  expect(Object.prototype.hasOwnProperty.call(value, field)).toBe(false);
  Object.values(value).forEach((entry) => assertObjectTreeHasNoSensitiveField(entry, field));
}
