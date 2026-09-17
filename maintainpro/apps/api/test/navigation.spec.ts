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

describe("navigation config (Phase 1 CMMS scope)", () => {
  it("exposes CMMS primary navigation for admin roles", () => {
    const hrefs = getVisibleNavigationItems("ADMIN").map((item) => item.href);

    expect(hrefs).toContain("/action-center");
    expect(hrefs).toContain("/maintenance/jobs");
    expect(hrefs).toContain("/maintenance/plans");
    expect(hrefs).toContain("/assets");
    expect(hrefs).toContain("/fleet");
    expect(hrefs).toContain("/inventory");
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/system-health");
    expect(hrefs).not.toContain("/workspace");
    expect(hrefs).not.toContain("/dashboard");
    expect(hrefs).not.toContain("/farm");
    expect(hrefs).not.toContain("/cleaning");
    expect(hrefs).not.toContain("/billing");
  });

  it("maps facility roles to Assets (facilities are not top-level)", () => {
    const facilityManagerItems = getVisibleNavigationItems("FACILITY_MANAGER");
    const buildingSupervisorItems = getVisibleNavigationItems("BUILDING_SUPERVISOR");
    const cleanerItems = getVisibleNavigationItems("CLEANER");

    expect(facilityManagerItems.map((item) => item.href)).toContain("/assets");
    expect(buildingSupervisorItems.map((item) => item.href)).toContain("/assets");
    expect(cleanerItems.map((item) => item.href)).toContain("/action-center");
    expect(cleanerItems.map((item) => item.href)).not.toContain("/facilities");
  });

  it("maps technician roles to Action Center and jobs without admin modules", () => {
    const technicianItems = getVisibleNavigationItems("TECHNICIAN");
    const ids = technicianItems.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["home", "all-jobs", "assets", "preventive-maintenance"])
    );
    expect(ids).not.toContain("admin");
    expect(ids).not.toContain("billing");
    expect(ids).not.toContain("dashboard");
  });

  it("maps store keeper roles to Spare Parts", () => {
    const inventoryItems = getVisibleNavigationItems("INVENTORY_KEEPER");
    const ids = inventoryItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["spare-parts", "home"]));
    expect(ids).not.toContain("admin");
  });

  it("maps supervisor roles to Requests, jobs, and PM", () => {
    const supervisorItems = getVisibleNavigationItems("SUPERVISOR");
    const ids = supervisorItems.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["home", "requests", "all-jobs", "preventive-maintenance"])
    );
    expect(ids).not.toContain("billing");
  });

  it("maps manager roles to reports and jobs", () => {
    const managerItems = getVisibleNavigationItems("MANAGER");
    const ids = managerItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["home", "reports", "all-jobs"]));
    expect(ids).not.toContain("admin");
  });

  it("maps finance approver roles to reports without work orders", () => {
    const financeItems = getVisibleNavigationItems("FINANCE_APPROVER");
    const ids = financeItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["home", "reports"]));
    expect(ids).not.toContain("work-orders");
    expect(ids).not.toContain("billing");
  });

  it("maps security officer roles to Fleet", () => {
    const securityItems = getVisibleNavigationItems("SECURITY_OFFICER");
    const ids = securityItems.map((item) => item.id);

    expect(ids).toEqual(expect.arrayContaining(["fleet", "home"]));
    expect(ids).not.toContain("admin");
  });

  it("retires cleaning workforce navigation for cleaner roles", () => {
    const cleanerItems = getVisibleNavigationItems("CLEANER");
    const hrefs = cleanerItems.map((item) => item.href);

    expect(hrefs).toContain("/action-center");
    expect(hrefs).not.toContain("/cleaning");
    expect(hrefs).not.toContain("/cleaning/issues");
    expect(hrefs).not.toContain("/work-orders");
  });

  it("returns Home fallback for unknown or missing roles", () => {
    expect(getVisibleNavigationItems(null).map((item) => item.id)).toEqual(
      expect.arrayContaining(["home"])
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

  it("uses Action Center label on /action-center and does not expose legacy /home as primary Home", () => {
    const allVisibleForAdmin = getVisibleNavigationItems("ADMIN", { fullNavigation: true });
    const homeItem = allVisibleForAdmin.find((item) => item.id === "home");

    expect(homeItem?.label).toBe("Action Center");
    expect(homeItem?.href).toBe("/action-center");
    expect(hasPrimaryHomeNavItem(allVisibleForAdmin)).toBe(false);
    expect(allVisibleForAdmin.some((item) => item.href === "/home")).toBe(false);
    expect(NAVIGATION_ITEMS.some((item) => item.href === "/home")).toBe(false);
  });

  it("highlights nested routes with startsWith matching", () => {
    const workOrders =
      NAVIGATION_ITEMS.find((item) => item.id === "all-jobs") ??
      NAVIGATION_ITEMS.find((item) => item.id === "work-orders");

    expect(workOrders).toBeDefined();
    expect(isNavItemActive(workOrders!.href, workOrders!)).toBe(true);
  });

  it("groups visible navigation by primary/secondary without empty groups", () => {
    const groups = getNavigationGroups("MANAGER");

    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    expect(groups.some((group) => group.items.length > 0)).toBe(true);
  });

  it("hides legacy FMS archive from normal operational roles", () => {
    for (const role of ["TECHNICIAN", "SECURITY_OFFICER", "INVENTORY_KEEPER", "MANAGER", "CLEANER"]) {
      const hrefs = getVisibleNavigationItems(role).map((item) => item.href);
      expect(hrefs).not.toContain("/home");
    }
  });

  it("restricts legacy FMS archive browser access to admin roles", () => {
    expect(canAccessLegacyFmsArchive("SUPER_ADMIN")).toBe(true);
    expect(canAccessLegacyFmsArchive("ADMIN")).toBe(true);
    expect(canAccessLegacyFmsArchive("TECHNICIAN")).toBe(false);
    for (const role of LEGACY_FMS_ARCHIVE_ROLES) {
      expect(canAccessNavigationPath("/home", role, [])).toBe(true);
    }
    expect(canAccessNavigationPath("/home", "TECHNICIAN", [])).toBe(false);
  });

  it("blocks admin routes for technicians via route guard helper", () => {
    expect(canAccessNavigationPath("/admin", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/admin/users", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/maintenance/jobs", "TECHNICIAN", [])).toBe(true);
    expect(canAccessNavigationPath("/work-orders/my", "TECHNICIAN", [])).toBe(true);
  });

  it("blocks retired product paths for non-admin roles", () => {
    expect(canAccessNavigationPath("/farm", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/cleaning", "CLEANER", [])).toBe(false);
    expect(canAccessNavigationPath("/billing", "FINANCE_APPROVER", [])).toBe(false);
    expect(canAccessNavigationPath("/predictive-ai", "MANAGER", [])).toBe(false);
    expect(canAccessNavigationPath("/farm", "ADMIN", [])).toBe(true);
  });

  it("does not invent FG Digital Records from role alone", () => {
    const adminWithoutFg = getVisibleNavigationItems("ADMIN", { permissions: [] });
    expect(adminWithoutFg.some((item) => item.id === "fg-digital-recording")).toBe(false);
    const withFg = getVisibleNavigationItems("MANAGER", { permissions: ["fg.access"] });
    expect(withFg.some((item) => item.href === "/fg")).toBe(false);
    expect(canAccessNavigationPath("/fg", "MANAGER", [])).toBe(false);
    expect(canAccessNavigationPath("/fg", "MANAGER", ["fg.access"])).toBe(true);
    expect(canAccessNavigationPath("/fg/sso/denied", "VIEWER", [])).toBe(true);
  });

  it("provides role default favorites", () => {
    expect(getDefaultFavoriteNavIds("TECHNICIAN")).toEqual(
      expect.arrayContaining(["home", "all-jobs"])
    );
    expect(getDefaultFavoriteNavIds("INVENTORY_KEEPER")).toEqual(
      expect.arrayContaining(["home", "spare-parts"])
    );
    expect(getDefaultFavoriteNavIds("ADMIN")).toEqual(
      expect.arrayContaining(["home", "admin", "system-health"])
    );
  });

  it("builds mobile bottom navigation items", () => {
    const technicianMobile = getMobileBottomNavItems("TECHNICIAN");
    expect(technicianMobile.some((item) => item.id === "home")).toBe(true);
    expect(technicianMobile.some((item) => item.action === "search")).toBe(true);
    expect(technicianMobile.some((item) => item.id === "work-orders")).toBe(true);
  });

  it("does not invent FG records in mobile nav without FG access", () => {
    const inventoryMobile = getMobileBottomNavItems("INVENTORY_KEEPER", { permissions: [] });
    expect(inventoryMobile.some((item) => item.href === "/fg")).toBe(false);
  });
});
