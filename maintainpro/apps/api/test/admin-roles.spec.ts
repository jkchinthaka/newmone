import {
  adminRolesMatrixAllowsMutations,
  filterRolesPermissionsMatrix,
  formatPermissionModuleLabel,
  formatRoleLabel,
  roleHasPermission,
  type AdminRolesPermissionsMatrix
} from "../../web/lib/admin-roles";

const sampleMatrix: AdminRolesPermissionsMatrix = {
  scope: "tenant",
  permissions: [
    { id: "perm-1", key: "users.view", module: "users", description: "View users" },
    { id: "perm-2", key: "users.edit", module: "users", description: "Edit users" }
  ],
  permissionGroups: [
    {
      module: "users",
      permissions: [
        { id: "perm-1", key: "users.view", module: "users", description: "View users" },
        { id: "perm-2", key: "users.edit", module: "users", description: "Edit users" }
      ]
    }
  ],
  roles: [
    {
      id: "role-admin",
      name: "ADMIN",
      tenantId: "tenant-a",
      tenantName: "Tenant A",
      permissionKeys: ["users.view", "users.edit"],
      permissionCount: 2,
      isBuiltIn: true
    },
    {
      id: "role-viewer",
      name: "VIEWER",
      tenantId: "tenant-a",
      tenantName: "Tenant A",
      permissionKeys: ["users.view"],
      permissionCount: 1,
      isBuiltIn: true
    }
  ],
  coverage: {
    "users.view": ["role-admin", "role-viewer"],
    "users.edit": ["role-admin"]
  }
};

describe("admin roles frontend helpers", () => {
  it("does not expose mutation actions in matrix config", () => {
    expect(adminRolesMatrixAllowsMutations()).toBe(false);
  });

  it("formats role and module labels safely", () => {
    expect(formatRoleLabel("SUPER_ADMIN")).toBe("SUPER ADMIN");
    expect(formatPermissionModuleLabel("work_orders")).toBe("Work Orders");
  });

  it("reports permission coverage per role", () => {
    expect(roleHasPermission(sampleMatrix, "users.edit", "role-admin")).toBe(true);
    expect(roleHasPermission(sampleMatrix, "users.edit", "role-viewer")).toBe(false);
  });

  it("filters matrix by role or permission search client-side", () => {
    const filtered = filterRolesPermissionsMatrix(sampleMatrix, "viewer");
    expect(filtered.roles).toHaveLength(1);
    expect(filtered.roles[0]?.name).toBe("VIEWER");
    expect(filtered.permissions.some((permission) => permission.key === "users.view")).toBe(true);
  });
});
