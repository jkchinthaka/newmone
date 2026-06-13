import {
  ADMIN_USER_ACCESS_SENSITIVE_FIELDS,
  ADMIN_USER_ACCESS_TABLE_FIELDS,
  adminUserAccessTableUsesSensitiveFields,
  canShowAdminUserStatusAction,
  formatAdminUserStatus,
  getAdminUserStatusActionLabel,
  type AdminUserAccessRow
} from "../../web/lib/admin-users";

const sampleRow: AdminUserAccessRow = {
  id: "user-target",
  displayName: "Target User",
  email: "target@example.com",
  roleName: "MANAGER",
  tenantId: "tenant-a",
  tenantName: "Tenant A",
  isActive: true,
  lastLogin: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z"
};

describe("admin users frontend helpers", () => {
  it("defines table fields without sensitive auth columns", () => {
    expect(adminUserAccessTableUsesSensitiveFields()).toBe(false);
    expect(ADMIN_USER_ACCESS_TABLE_FIELDS).toEqual(
      expect.arrayContaining(["displayName", "email", "roleName", "isActive", "lastLogin", "createdAt"])
    );

    for (const field of ADMIN_USER_ACCESS_SENSITIVE_FIELDS) {
      expect(ADMIN_USER_ACCESS_TABLE_FIELDS).not.toContain(field);
    }
  });

  it("formats active status labels safely", () => {
    expect(formatAdminUserStatus(true)).toBe("Active");
    expect(formatAdminUserStatus(false)).toBe("Inactive");
  });

  it("hides status actions for self, missing viewer context, and SUPER_ADMIN rows for ADMIN viewers", () => {
    expect(
      canShowAdminUserStatusAction(sampleRow, {
        viewerUserId: "admin-1",
        viewerRoleName: "ADMIN"
      })
    ).toBe(true);

    expect(
      canShowAdminUserStatusAction(sampleRow, {
        viewerUserId: "user-target",
        viewerRoleName: "ADMIN"
      })
    ).toBe(false);

    expect(
      canShowAdminUserStatusAction(
        { ...sampleRow, roleName: "SUPER_ADMIN" },
        { viewerUserId: "admin-1", viewerRoleName: "ADMIN" }
      )
    ).toBe(false);

    expect(
      canShowAdminUserStatusAction(sampleRow, {
        viewerUserId: null,
        viewerRoleName: "ADMIN"
      })
    ).toBe(false);
  });

  it("returns deactivate/reactivate action labels", () => {
    expect(getAdminUserStatusActionLabel(true)).toBe("Deactivate");
    expect(getAdminUserStatusActionLabel(false)).toBe("Reactivate");
  });
});
