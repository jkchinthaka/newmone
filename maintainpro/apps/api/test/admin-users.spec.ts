import {
  ADMIN_USER_ACCESS_SENSITIVE_FIELDS,
  ADMIN_USER_ACCESS_TABLE_FIELDS,
  adminUserAccessTableUsesSensitiveFields,
  formatAdminUserStatus
} from "../../web/lib/admin-users";

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
});
