import {
  canAccessLegacyFmsArchive,
  LEGACY_FMS_ARCHIVE_ROLES
} from "../../web/lib/legacy-fms-access";
import {
  canAccessNavigationPath,
  EXISTING_NAV_ROUTES,
  getDefaultFavoriteNavIds,
  getMobileBottomNavItems,
  getNavigationGroups,
  getVisibleNavigationItems,
  hasPrimaryHomeNavItem,
  isNavItemActive,
  NAVIGATION_ITEMS
} from "../../web/lib/navigation";
import { MAINTENANCE_FORECAST_EMPTY_MESSAGE } from "../../web/lib/maintenance-forecast-copy";
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
    expect(hrefs).not.toContain("/system-health");
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
    // Requests requires the list permission the API checks (seeded SUPERVISOR holds it).
    const supervisorItems = getVisibleNavigationItems("SUPERVISOR", {
      permissions: ["maintenance_requests.view_own", "maintenance_requests.triage"]
    });
    const ids = supervisorItems.map((item) => item.id);

    expect(ids).toEqual(
      expect.arrayContaining(["home", "requests", "all-jobs", "preventive-maintenance"])
    );
    expect(ids).not.toContain("billing");
    expect(ids).not.toContain("spare-parts");
    expect(canAccessNavigationPath("/inventory", "SUPERVISOR", ["maintenance_requests.view_own"])).toBe(false);
  });

  it("hides Requests when the role lacks the request list permission (API would return 403)", () => {
    const technicianIds = getVisibleNavigationItems("TECHNICIAN", {
      permissions: ["work_orders.view_own", "work_orders.update_status"]
    }).map((item) => item.id);
    expect(technicianIds).not.toContain("requests");
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

  it("keeps maintenance forecast out of the primary maintenance menu", () => {
    const groups = getNavigationGroups("MANAGER");
    const maintenance = groups.find((group) => group.category === "operations");
    const planning = groups.find((group) => group.category === "advanced");

    expect(maintenance?.items.some((item) => item.id === "planning")).toBe(false);
    expect(planning?.label).toBe("Advanced Maintenance");
    expect(planning?.items.map((item) => item.href)).toContain("/maintenance/planning");
    expect(canAccessNavigationPath("/maintenance/forecast", "MANAGER", [])).toBe(true);
    expect(canAccessNavigationPath("/maintenance/planning", "MANAGER", [])).toBe(true);
    expect(MAINTENANCE_FORECAST_EMPTY_MESSAGE).toContain("meter");
    expect(MAINTENANCE_FORECAST_EMPTY_MESSAGE).toContain("usage");
    expect(MAINTENANCE_FORECAST_EMPTY_MESSAGE).toContain("preventive maintenance history");
  });

  it("keeps inspections out of the primary maintenance menu", () => {
    const groups = getNavigationGroups("MANAGER");
    const maintenance = groups.find((group) => group.category === "operations");
    const planning = groups.find((group) => group.category === "advanced");
    const inspections = NAVIGATION_ITEMS.find((item) => item.id === "inspections");

    expect(maintenance?.items.some((item) => item.id === "inspections")).toBe(false);
    expect(planning?.label).toBe("Advanced Maintenance");
    expect(planning?.items.map((item) => item.href)).toContain("/maintenance/inspections");
    expect(inspections?.allowedRoles).toEqual(
      NAVIGATION_ITEMS.find((item) => item.id === "all-jobs")?.allowedRoles
    );
    expect(canAccessNavigationPath("/maintenance/inspections", "MANAGER", [])).toBe(true);
    expect(canAccessNavigationPath("/maintenance/inspections/insp-1", "TECHNICIAN", [])).toBe(true);
    expect(EXISTING_NAV_ROUTES.has("/maintenance/inspections")).toBe(true);
  });

  it("keeps reliability out of the primary maintenance menu", () => {
    const groups = getNavigationGroups("MANAGER");
    const maintenance = groups.find((group) => group.category === "operations");
    const advanced = groups.find((group) => group.category === "advanced");
    const categoryOf = (id: string) => NAVIGATION_ITEMS.find((item) => item.id === id)?.category;

    expect(maintenance?.items.some((item) => item.id === "reliability")).toBe(false);
    expect(groups.some((group) => group.category === "safety")).toBe(false);
    expect(categoryOf("all-jobs")).toBe("operations");
    expect(categoryOf("requests")).toBe("operations");
    expect(categoryOf("preventive-maintenance")).toBe("operations");
    expect(categoryOf("my-jobs")).toBe("operations");
    expect(advanced?.label).toBe("Advanced Maintenance");
    expect(advanced?.items.map((item) => item.href)).toContain("/maintenance/reliability");
    expect(getVisibleNavigationItems("MANAGER").some((item) => item.id === "reliability")).toBe(true);
    expect(getVisibleNavigationItems("TECHNICIAN").some((item) => item.id === "reliability")).toBe(false);
    expect(canAccessNavigationPath("/maintenance/reliability", "MANAGER", [])).toBe(true);
    expect(canAccessNavigationPath("/maintenance/reliability/rca/rca-1", "MAINTENANCE_SUPERVISOR", [])).toBe(true);
    expect(EXISTING_NAV_ROUTES.has("/maintenance/reliability")).toBe(true);
  });

  it("keeps pending approvals out of the primary maintenance menu", () => {
    const groups = getNavigationGroups("MANAGER", { permissions: ["approvals.view"] });
    const maintenance = groups.find((group) => group.category === "operations");
    const planning = groups.find((group) => group.category === "advanced");
    const approvals = NAVIGATION_ITEMS.find((item) => item.id === "approvals");

    expect(maintenance?.items.some((item) => item.id === "approvals")).toBe(false);
    expect(planning?.items.map((item) => item.href)).toContain("/approvals");
    expect(approvals?.requiredPermissions).toEqual(["approvals.view"]);
    expect(approvals?.href).toBe("/approvals");
    expect(getVisibleNavigationItems("MANAGER", { permissions: ["approvals.view"] }).some((item) => item.id === "approvals")).toBe(true);
    expect(getVisibleNavigationItems("TECHNICIAN", { permissions: ["approvals.view"] }).some((item) => item.id === "approvals")).toBe(false);
    expect(canAccessNavigationPath("/approvals", "MANAGER", ["approvals.view"])).toBe(true);
    expect(canAccessNavigationPath("/approvals/req-1", "SUPERVISOR", ["approvals.view"])).toBe(true);
    expect(EXISTING_NAV_ROUTES.has("/approvals")).toBe(true);
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
    expect(canAccessNavigationPath("/work-orders/my", "INVENTORY_KEEPER", [])).toBe(false);
    expect(canAccessNavigationPath("/maintenance/jobs", "INVENTORY_KEEPER", [])).toBe(true);
    expect(canAccessNavigationPath("/maintenance/jobs", "CLEANER", [])).toBe(false);
    expect(canAccessNavigationPath("/maintenance", "CLEANER", [])).toBe(false);
  });

  it("blocks retired product paths for non-admin roles", () => {
    expect(canAccessNavigationPath("/farm", "TECHNICIAN", [])).toBe(false);
    expect(canAccessNavigationPath("/cleaning", "CLEANER", [])).toBe(false);
    expect(canAccessNavigationPath("/billing", "FINANCE_APPROVER", [])).toBe(false);
    expect(canAccessNavigationPath("/predictive-ai", "MANAGER", [])).toBe(false);
    expect(canAccessNavigationPath("/farm", "ADMIN", [])).toBe(true);
  });

  it("does not expose FG Digital Records navigation or path access", () => {
    const adminItems = getVisibleNavigationItems("ADMIN", { permissions: [] });
    expect(adminItems.some((item) => item.id === "fg-digital-recording")).toBe(false);
    expect(adminItems.some((item) => item.href === "/fg" || String(item.href).startsWith("/fg/"))).toBe(false);
    expect(canAccessNavigationPath("/fg", "MANAGER", [])).toBe(false);
    expect(canAccessNavigationPath("/fg", "SUPER_ADMIN", [])).toBe(false);
    expect(canAccessNavigationPath("/fg/sso/denied", "VIEWER", [])).toBe(false);
  });

  it("provides role default favorites", () => {
    expect(getDefaultFavoriteNavIds("TECHNICIAN")).toEqual(
      expect.arrayContaining(["home", "all-jobs"])
    );
    expect(getDefaultFavoriteNavIds("INVENTORY_KEEPER")).toEqual(
      expect.arrayContaining(["home", "spare-parts"])
    );
    expect(getDefaultFavoriteNavIds("ADMIN")).toEqual(
      expect.arrayContaining(["home", "admin"])
    );
    expect(getDefaultFavoriteNavIds("ADMIN")).not.toContain("system-health");
    expect(getDefaultFavoriteNavIds("SUPER_ADMIN")).toEqual(
      expect.arrayContaining(["home", "admin", "system-health"])
    );
    expect(getVisibleNavigationItems("SUPER_ADMIN").map((item) => item.href)).toContain("/system-health");
    expect(canAccessNavigationPath("/system-health", "ADMIN", [])).toBe(false);
    expect(canAccessNavigationPath("/system-health", "SUPER_ADMIN", [])).toBe(true);
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

  it("keeps ERP sync and maintenance supply out of the inventory menu", () => {
    const groups = getNavigationGroups("ADMIN");
    const inventory = groups.find((group) => group.category === "reports");
    const admin = groups.find((group) => group.category === "admin");

    expect(inventory?.items.some((item) => item.id === "spare-parts")).toBe(true);
    expect(inventory?.items.some((item) => item.id === "erp-integration" || item.id === "maintenance-supply")).toBe(false);
    expect(admin?.items.map((item) => item.id)).toEqual(expect.arrayContaining(["erp-integration", "maintenance-supply"]));
    expect(canAccessNavigationPath("/erp", "ADMIN", [])).toBe(true);
    expect(canAccessNavigationPath("/maintenance-supply", "ADMIN", [])).toBe(true);
    expect(canAccessNavigationPath("/erp", "INVENTORY_KEEPER", [])).toBe(false);
    expect(canAccessNavigationPath("/maintenance-supply", "INVENTORY_KEEPER", [])).toBe(true);
    expect(EXISTING_NAV_ROUTES.has("/erp")).toBe(true);
    expect(EXISTING_NAV_ROUTES.has("/maintenance-supply")).toBe(true);
  });
});
