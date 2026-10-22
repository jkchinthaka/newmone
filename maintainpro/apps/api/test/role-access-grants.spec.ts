import { applyV103Grants, ROLE_ACCESS_GRANTS_20261022 } from "../src/database/v103-grants";

function prismaMock(existingLinks: Array<{ roleId: string; permissionId: string }>) {
  const permissions: Record<string, { id: string; key: string }> = {
    "maintenance_requests.create": { id: "p-req", key: "maintenance_requests.create" },
    "planning.view": { id: "p-view", key: "planning.view" },
    "planning.manage": { id: "p-manage", key: "planning.manage" }
  };
  const roles = [
    { id: "r-tech", name: "TECHNICIAN", tenantId: "t1" },
    { id: "r-sup", name: "SUPERVISOR", tenantId: "t1" }
  ];
  return {
    permission: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) => permissions[where.key] ?? null),
      create: jest.fn()
    },
    role: {
      findMany: jest.fn(async ({ where }: { where: { name: string | { in: string[] } } }) =>
        roles.filter((role) =>
          typeof where.name === "string" ? role.name === where.name : where.name.in.includes(role.name)
        )
      )
    },
    rolePermission: {
      findFirst: jest.fn(async ({ where }: { where: { roleId: string; permissionId: string } }) =>
        existingLinks.find((link) => link.roleId === where.roleId && link.permissionId === where.permissionId) ?? null
      ),
      create: jest.fn()
    },
    approvalRule: { findMany: jest.fn(async () => []) },
    approvalRuleLevel: { create: jest.fn() }
  };
}

describe("2026-10-22 role access grants", () => {
  it("lists the owner-approved grants", () => {
    expect(ROLE_ACCESS_GRANTS_20261022).toEqual([
      { role: "TECHNICIAN", permission: "planning.view" },
      { role: "TECHNICIAN", permission: "planning.manage" },
      { role: "SUPERVISOR", permission: "planning.view" }
    ]);
  });

  it("dry-run reports the grants and writes nothing", async () => {
    const prisma = prismaMock([]);
    const lines = await applyV103Grants(prisma as never, { dryRun: true });
    expect(lines).toEqual(
      expect.arrayContaining([
        "GRANT planning.view to TECHNICIAN (t1)",
        "GRANT planning.manage to TECHNICIAN (t1)",
        "GRANT planning.view to SUPERVISOR (t1)"
      ])
    );
    expect(prisma.rolePermission.create).not.toHaveBeenCalled();
  });

  it("apply adds only missing links and keeps existing ones", async () => {
    const prisma = prismaMock([{ roleId: "r-tech", permissionId: "p-view" }]);
    const lines = await applyV103Grants(prisma as never, { dryRun: false });
    expect(lines).toContain("KEEP planning.view on TECHNICIAN (t1)");
    const created = prisma.rolePermission.create.mock.calls.map((call) => call[0].data);
    expect(created).toEqual(
      expect.arrayContaining([
        { roleId: "r-tech", permissionId: "p-manage" },
        { roleId: "r-sup", permissionId: "p-view" }
      ])
    );
    expect(created).not.toContainEqual({ roleId: "r-tech", permissionId: "p-view" });
  });
});
