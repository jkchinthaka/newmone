import {
  canAccessLegacyFmsArchive,
  LEGACY_FMS_ARCHIVE_ROLES
} from "../../web/lib/legacy-fms-access";
import {
  canAccessNavigationPath,
  getDefaultFavoriteNavIds,
  getMobileBottomNavItems,
  getNavigationGroups,
  getVisibleNavigationItems,
  hasPrimaryHomeNavItem,
  isNavItemActive,
  NAVIGATION_ITEMS
} from "../../web/lib/navigation";
import { getPostLoginRedirect } from "../../web/lib/role-redirect";

describe("navigation config", () => {
  it("maps facility roles to facilities navigation", () => {
    const facilityManagerItems = getVisibleNavigationItems("FACILITY_MANAGER");
    const buildingSupervisorItems = getVisibleNavigationItems("BUILDING_SUPERVISOR");
    const cleanerItems = getVisibleNavigationItems("CLEANER");

    expect(facilityManagerItems.map((item) => item.href)).toContain("/facilities");
    expect(buildingSupervisorItems.map((item) => item.href)).toContain("/facilities");
    expect(cleanerItems.map((item) => item.href)).not.toContain("/facilities");
  });

  it("maps admin roles to workspace, dashboard, and system health", () => {
    const adminItems = getVisibleNavigationItems("ADMIN");
    const hrefs = adminItems.map((item) => item.href);

    expect(hrefs).toContain("/workspace");
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/action-center");
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/system-health");
    expect(hrefs).toContain("/work-orders");
    expect(hrefs).toContain("/inventory");
  });

  it("maps technician roles to workspace tasks without admin modules", () => {
    const technicianItems = getVisibleNavigationItems("TECHNICIAN");
    const ids = technicianItems.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["my-workspace", "action-center", "my-tasks", "work-orders", "assets"])
    );
    expect(ids).not.toContain("admin-console");
    expect(ids).not.toContain("billing");
    expect(ids).not.toContain("dashboard");
    expect(ids).not.toContain("inventory");
  });

  it("maps store keeper roles to inventory workspace shortcuts", () => {
    const inventoryItems = getVisibleNavigationItems("INVENTORY_KEEPER");
    const ids = inventoryItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["inventory", "waiting-parts", "action-center"]));
    expect(ids).not.toContain("admin-console");
    expect(ids).not.toContain("dashboard");
  });

  it("maps supervisor roles to verification and high risk shortcuts", () => {
    const supervisorItems = getVisibleNavigationItems("SUPERVISOR");
    const ids = supervisorItems.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["supervisor-verification", "high-risk-queue", "action-center", "work-orders"])
    );
    expect(ids).not.toContain("billing");
  });

  it("maps manager roles to high risk and reports", () => {
    const managerItems = getVisibleNavigationItems("MANAGER");
    const ids = managerItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["high-risk-queue", "reports", "action-center"]));
    expect(ids).not.toContain("admin-console");
  });

  it("maps finance approver roles to billing and reports", () => {
    const financeItems = getVisibleNavigationItems("FINANCE_APPROVER");
    const ids = financeItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["billing", "reports", "action-center"]));
    expect(ids).not.toContain("work-orders");
  });

  it("maps security officer roles to gate workspace shortcuts", () => {
    const securityItems = getVisibleNavigationItems("SECURITY_OFFICER");
    const ids = securityItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["fleet-gate", "action-center"]));
    expect(ids).not.toContain("admin-console");
  });

  it("maps cleaner roles to cleaning routes", () => {
    const cleanerItems = getVisibleNavigationItems("CLEANER");
    const hrefs = cleanerItems.map((item) => item.href);

    expect(hrefs).toContain("/cleaning");
    expect(hrefs).toContain("/cleaning/issues");
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/work-orders");
  });

  it("returns action center fallback for unknown or missing roles", () => {
    expect(getVisibleNavigationItems(null).map((item) => item.id)).toEqual(
      expect.arrayContaining(["my-workspace", "action-center"])
    );
    expect(getVisibleNavigationItems("UNKNOWN_ROLE")).toEqual([
      expect.objectContaining({ href: "/action-center" })
    ]);
  });

  it("prioritizes action center as post-login landing for operational roles", () => {
    expect(getPostLoginRedirect("TECHNICIAN")).toBe("/action-center");
    expect(getPostLoginRedirect("INVENTORY_KEEPER")).toBe("/action-center");
    expect(getPostLoginRedirect("MANAGER")).toBe("/action-center");
  });

  it("does not expose /home as a primary Home nav item", () => {
    const allVisibleForAdmin = getVisibleNavigationItems("ADMIN", { fullNavigation: true });
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

  it("matches queue-specific work order links", () => {
    const myTasks = NAVIGATION_ITEMS.find((item) => item.id === "my-tasks");

    expect(myTasks).toBeDefined();
    expect(isNavItemActive("/work-orders", myTasks!, "queue=my-tasks")).toBe(true);
    expect(isNavItemActive("/work-orders", myTasks!, "queue=assigned")).toBe(false);
  });

  it("groups visible navigation by category without empty groups", () => {
    const groups = getNavigationGroups("MANAGER");

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    expect(groups.some((group) => group.category === "workspace")).toBe(true);
    expect(groups.some((group) => group.category === "operations")).toBe(true);
  });

  it("hides legacy FMS archive from normal operational roles", () => {
    for (const role of ["TECHNICIAN", "SECURITY_OFFICER", "INVENTORY_KEEPER", "MANAGER", "CLEANER"]) {
      const hrefs = getVisibleNavigationItems(role).map((item) => item.href);
      expect(hrefs).not.toContain("/home");
    }
  });

  it("restricts legacy FMS archive access to admin roles in full navigation mode", () => {
    expect(canAccessLegacyFmsArchive("SUPER_ADMIN")).toBe(true);
    expect(canAccessLegacyFmsArchive("ADMIN")).toBe(true);
    expect(canAccessLegacyFmsArchive("TECHNICIAN")).toBe(false);
    for (const role of LEGACY_FMS_ARCHIVE_ROLES) {
      expect(getVisibleNavigationItems(role, { fullNavigation: true }).map((item) => item.href)).toContain(
        "/home"
      );
    }
  });

  it("blocks admin routes for technicians via route guard helper", () => {
    expect(canAccessNavigationPath("/admin", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/admin/users", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/work-orders", "TECHNICIAN", [])).toBe(true);
    expect(canAccessNavigationPath("/work-orders/abc", "TECHNICIAN", [])).toBe(true);
  });

  it("provides role default favorites", () => {
    expect(getDefaultFavoriteNavIds("TECHNICIAN")).toEqual(
      expect.arrayContaining(["my-tasks", "action-center"])
    );
    expect(getDefaultFavoriteNavIds("INVENTORY_KEEPER")).toEqual(
      expect.arrayContaining(["inventory", "waiting-parts"])
    );
    expect(getDefaultFavoriteNavIds("ADMIN")).toEqual(
      expect.arrayContaining(["system-health", "admin-console"])
    );
  });

  it("builds mobile bottom navigation items", () => {
    const technicianMobile = getMobileBottomNavItems("TECHNICIAN");
    expect(technicianMobile.some((item) => item.id === "home")).toBe(true);
    expect(technicianMobile.some((item) => item.action === "search")).toBe(true);
  });
});
