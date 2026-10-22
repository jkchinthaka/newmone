import { RoleName } from "@prisma/client";
import { RolesService } from "../src/modules/roles/roles.service";
import { rolePermissions, syncRolePermissions } from "../src/database/seed";
import { ACCESS_STUDIO_ROUTE_GRANTS, isAccessStudioKey } from "../src/common/auth/access-route-keys";
import { accessStudioEnabled, setAccessStudioRuntimeAllowed } from "../src/common/auth/effective-permissions";
import { applyAccessStudioStartup } from "../src/bootstrap/access-studio-startup";

describe("Access Studio role saves", () => {
  const previous = process.env.ACCESS_STUDIO_ENABLED;
  afterEach(() => {
    if (previous === undefined) delete process.env.ACCESS_STUDIO_ENABLED;
    else process.env.ACCESS_STUDIO_ENABLED = previous;
    setAccessStudioRuntimeAllowed(true);
  });

  function fixture() {
    const keys = [...new Set([
      ...(rolePermissions[RoleName.MANAGER] ?? []),
      ...Object.entries(ACCESS_STUDIO_ROUTE_GRANTS).filter(([, roles]) => roles.includes(RoleName.MANAGER)).map(([key]) => key)
    ])];
    let rows = keys.map((key, i) => ({
      id: `link-${i}`, roleId: "role-1", permissionId: `permission-${i}`, permission: { key }
    }));
    const role = { id: "role-1", name: RoleName.MANAGER, tenantId: "tenant-1" };
    const tx = {
      role: { findUnique: jest.fn(async () => ({ ...role, permissionLinks: rows })) },
      rolePermission: {
        findMany: jest.fn(async () => rows),
        deleteMany: jest.fn(async ({ where }) => { rows = rows.filter((r) => !where.id.in.includes(r.id)); }),
        createMany: jest.fn()
      },
      auditLog: { create: jest.fn() }
    };
    const prisma = { ...tx, $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) };
    return { rows: () => rows, tx, prisma, service: new RolesService(prisma as any) };
  }

  it("preserves omitted Studio rows while off and passes startup parity afterwards", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const f = fixture();
    const studio = f.rows().filter((r) => isAccessStudioKey(r.permission.key));
    expect(studio.length).toBeGreaterThan(0);
    await f.service.update("role-1", {
      permissionIds: f.rows().filter((r) => !isAccessStudioKey(r.permission.key)).map((r) => r.permissionId)
    });
    for (const row of studio) expect(f.rows()).toContain(row);
    expect(f.tx.rolePermission.deleteMany).not.toHaveBeenCalled();
    process.env.ACCESS_STUDIO_ENABLED = "true";
    await applyAccessStudioStartup({
      appSetting: { findUnique: async () => ({ value: "2" }) },
      role: { findMany: async () => [{ name: RoleName.MANAGER, tenantId: "tenant-1", permissionLinks: f.rows() }] }
    });
    expect(accessStudioEnabled()).toBe(true);
  });

  it("still removes omitted ordinary permissions while off, including an empty save", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const f = fixture();
    await f.service.update("role-1", { permissionIds: [] });
    expect(f.rows().length).toBeGreaterThan(0);
    expect(f.rows().every((r) => isAccessStudioKey(r.permission.key))).toBe(true);
    expect(f.tx.auditLog.create).toHaveBeenCalled();
  });

  it("allows explicit removal of Studio permissions while on", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "true";
    setAccessStudioRuntimeAllowed(true);
    const f = fixture();
    await f.service.update("role-1", { permissionIds: [] });
    expect(f.rows()).toEqual([]);
  });

  it("preserves Studio link identities in the seed replacement path while off", async () => {
    process.env.ACCESS_STUDIO_ENABLED = "false";
    const f = fixture();
    const studio = f.rows().filter((r) => isAccessStudioKey(r.permission.key));
    await syncRolePermissions("role-1", [], f.prisma as any);
    expect(f.rows()).toEqual(studio);
    expect(studio.length).toBeGreaterThan(0);
  });
});
