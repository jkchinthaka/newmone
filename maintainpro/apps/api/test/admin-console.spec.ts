import {
  adminConsoleSectionsHaveMetricCounts,
  getAdminConsoleSections,
  isAdminConsoleRole
} from "../../web/lib/admin-console";
import { getVisibleNavigationItems } from "../../web/lib/navigation";
import { getCommandPaletteItems } from "../../web/lib/command-palette";

describe("admin console foundation", () => {
  it("allows only ADMIN and SUPER_ADMIN admin console roles", () => {
    expect(isAdminConsoleRole("ADMIN")).toBe(true);
    expect(isAdminConsoleRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminConsoleRole("admin")).toBe(true);
    expect(isAdminConsoleRole("TECHNICIAN")).toBe(false);
    expect(isAdminConsoleRole("VIEWER")).toBe(false);
    expect(isAdminConsoleRole("UNKNOWN_ROLE")).toBe(false);
    expect(isAdminConsoleRole(null)).toBe(false);
  });

  it("exposes /admin navigation only for admin roles", () => {
    const adminItems = getVisibleNavigationItems("ADMIN");
    const superAdminItems = getVisibleNavigationItems("SUPER_ADMIN");
    const technicianItems = getVisibleNavigationItems("TECHNICIAN");

    expect(adminItems.some((item) => item.href === "/admin")).toBe(true);
    expect(superAdminItems.some((item) => item.href === "/admin")).toBe(true);
    expect(technicianItems.some((item) => item.href === "/admin")).toBe(false);
    expect(getVisibleNavigationItems("UNKNOWN_ROLE").some((item) => item.href === "/admin")).toBe(false);
  });

  it("includes /admin in command palette only for admin roles", () => {
    expect(getCommandPaletteItems("ADMIN").some((item) => item.href === "/admin")).toBe(true);
    expect(getCommandPaletteItems("SUPER_ADMIN").some((item) => item.href === "/admin")).toBe(true);
    expect(getCommandPaletteItems("TECHNICIAN").some((item) => item.href === "/admin")).toBe(false);
    expect(getCommandPaletteItems("CLEANER").some((item) => item.href === "/admin")).toBe(false);
    expect(getCommandPaletteItems(null).some((item) => item.href === "/admin")).toBe(false);
  });

  it("defines safe read-only admin sections without fake metric counts", () => {
    const sections = getAdminConsoleSections();

    expect(sections.length).toBeGreaterThan(0);
    expect(adminConsoleSectionsHaveMetricCounts(sections)).toBe(false);
    expect(sections.every((section) => typeof section.title === "string" && typeof section.description === "string")).toBe(
      true
    );

    const tenants = sections.find((section) => section.id === "tenants");
    expect(tenants?.status).toBe("available");
    expect(tenants?.href).toBe("/admin/tenants");
    expect(tenants?.description).toMatch(/read-only/i);

    const systemHealth = sections.find((section) => section.id === "system-health");
    expect(systemHealth?.href).toBe("/system-health");

    const usersAccess = sections.find((section) => section.id === "users-access");
    expect(usersAccess?.href).toBe("/admin/users");

    const rolesPermissions = sections.find((section) => section.id === "roles-permissions");
    expect(rolesPermissions?.status).toBe("available");
    expect(rolesPermissions?.href).toBe("/admin/roles");
    expect(rolesPermissions?.description).toMatch(/read-only|review/i);

    const invitations = sections.find((section) => section.id === "invitations-onboarding");
    expect(invitations?.status).toBe("available");
    expect(invitations?.href).toBe("/admin/invitations");
    expect(invitations?.description).toMatch(/read-only|review/i);
  });
});
