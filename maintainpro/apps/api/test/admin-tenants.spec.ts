import {
  ADMIN_TENANT_SENSITIVE_FIELDS,
  ADMIN_TENANT_TABLE_FIELDS,
  adminTenantOverviewUsesSensitiveFields,
  formatAdminTenantStatus
} from "../../web/lib/admin-tenants";

describe("admin tenants frontend helpers", () => {
  it("defines table fields without sensitive tenant config columns", () => {
    expect(adminTenantOverviewUsesSensitiveFields()).toBe(false);
    expect(ADMIN_TENANT_TABLE_FIELDS).toEqual(
      expect.arrayContaining(["name", "slug", "isActive", "memberCount", "createdAt", "updatedAt"])
    );

    for (const field of ADMIN_TENANT_SENSITIVE_FIELDS) {
      expect(ADMIN_TENANT_TABLE_FIELDS).not.toContain(field);
    }
  });

  it("formats tenant status labels safely", () => {
    expect(formatAdminTenantStatus(true)).toBe("Active");
    expect(formatAdminTenantStatus(false)).toBe("Inactive");
  });
});
