import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";

const actor = { sub: "super-1", email: "super@test.local", role: RoleName.SUPER_ADMIN, tenantId: "tenant-a" };

describe("Admin Console role permission matrix", () => {
  it("updates a role's permissionIds and writes a ROLE_PERMISSIONS_UPDATED audit entry", async () => {
    const auditEntries: any[] = [];
    const prisma: any = {
      role: {
        findUnique: jest.fn().mockResolvedValue({ permissionIds: ["perm-old"] })
      },
      auditLog: {
        create: jest.fn(async ({ data }: any) => {
          auditEntries.push(data);
          return { id: "audit-1" };
        })
      }
    };
    const rolesService: any = {
      update: jest.fn(async (id: string, data: { permissionIds: string[] }) => ({
        id,
        name: RoleName.MANAGER,
        permissionCount: data.permissionIds.length,
        permissions: data.permissionIds.map((permissionId) => ({ id: permissionId, key: permissionId, description: null }))
      }))
    };

    const controller = new AdminAccessController(
      {} as any,
      rolesService,
      {} as any,
      {} as any,
      {} as any,
      prisma
    );

    const result = await requestContext.run(
      { actorId: actor.sub, actorEmail: actor.email, actorRole: actor.role, tenantId: actor.tenantId, module: "admin-roles", ipAddress: null, userAgent: null, requestPath: "/admin/roles/role-manager/permissions" },
      () =>
        controller.updateRolePermissions(
          { user: actor as any },
          "role-manager",
          { permissionIds: ["perm-a", "perm-b"] }
        )
    );

    expect(rolesService.update).toHaveBeenCalledWith("role-manager", { permissionIds: ["perm-a", "perm-b"] });
    expect(result.data.permissionCount).toBe(2);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].metadata.event).toBe("ROLE_PERMISSIONS_UPDATED");
    expect(auditEntries[0].beforeData).toEqual({ permissionIds: ["perm-old"] });
    expect(auditEntries[0].afterData).toEqual({ permissionIds: ["perm-a", "perm-b"] });
  });
});
