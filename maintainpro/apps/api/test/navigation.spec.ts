import {
  getNavigationGroups,
  getVisibleNavigationItems,
  hasPrimaryHomeNavItem,
  isNavItemActive,
  NAVIGATION_ITEMS
} from "../../web/lib/navigation";

describe("navigation config", () => {
  it("maps admin roles to dashboard and system health", () => {
    const adminItems = getVisibleNavigationItems("ADMIN");
    const hrefs = adminItems.map((item) => item.href);

    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/system-health");
    expect(hrefs).toContain("/work-orders");
    expect(hrefs).toContain("/inventory");
  });

  it("maps technician roles to work orders and assets only", () => {
    const technicianItems = getVisibleNavigationItems("TECHNICIAN");
    const hrefs = technicianItems.map((item) => item.href);

    expect(hrefs).toEqual(expect.arrayContaining(["/work-orders", "/assets"]));
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/inventory");
  });

  it("maps cleaner roles to cleaning routes", () => {
    const cleanerItems = getVisibleNavigationItems("CLEANER");
    const hrefs = cleanerItems.map((item) => item.href);

    expect(hrefs).toContain("/cleaning");
    expect(hrefs).toContain("/cleaning/issues");
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/work-orders");
  });

  it("maps inventory keeper roles to inventory and procurement", () => {
    const inventoryItems = getVisibleNavigationItems("INVENTORY_KEEPER");
    const hrefs = inventoryItems.map((item) => item.href);

    expect(hrefs).toEqual(expect.arrayContaining(["/inventory", "/procurement"]));
    expect(hrefs).not.toContain("/dashboard");
  });

  it("returns dashboard only for unknown or missing roles", () => {
    expect(getVisibleNavigationItems(null)).toEqual([
      expect.objectContaining({ href: "/dashboard" })
    ]);
    expect(getVisibleNavigationItems(undefined)).toEqual([
      expect.objectContaining({ href: "/dashboard" })
    ]);
    expect(getVisibleNavigationItems("UNKNOWN_ROLE")).toEqual([
      expect.objectContaining({ href: "/dashboard" })
    ]);
  });

  it("does not expose /home as a primary Home nav item", () => {
    const allVisibleForAdmin = getVisibleNavigationItems("ADMIN");
    const legacyItem = NAVIGATION_ITEMS.find((item) => item.id === "legacy-fms-archive");

    expect(legacyItem?.label).toBe("Legacy FMS Archive");
    expect(legacyItem?.legacy).toBe(true);
    expect(hasPrimaryHomeNavItem(allVisibleForAdmin)).toBe(false);
    expect(allVisibleForAdmin.some((item) => item.label === "Home")).toBe(false);
  });

  it("highlights nested routes with startsWith matching", () => {
    const workOrders = NAVIGATION_ITEMS.find((item) => item.id === "work-orders");

    expect(workOrders).toBeDefined();
    expect(isNavItemActive("/work-orders", workOrders!)).toBe(true);
    expect(isNavItemActive("/work-orders/abc-123", workOrders!)).toBe(true);
    expect(isNavItemActive("/work-orders-archive", workOrders!)).toBe(false);
  });

  it("uses exact matching for dashboard and legacy archive routes", () => {
    const dashboard = NAVIGATION_ITEMS.find((item) => item.id === "dashboard");
    const legacy = NAVIGATION_ITEMS.find((item) => item.id === "legacy-fms-archive");

    expect(isNavItemActive("/dashboard", dashboard!)).toBe(true);
    expect(isNavItemActive("/dashboard/settings", dashboard!)).toBe(false);
    expect(isNavItemActive("/home", legacy!)).toBe(true);
    expect(isNavItemActive("/home/archive", legacy!)).toBe(false);
  });

  it("groups visible navigation by category without empty groups", () => {
    const groups = getNavigationGroups("MANAGER");

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    expect(groups.some((group) => group.category === "operations")).toBe(true);
  });
});
