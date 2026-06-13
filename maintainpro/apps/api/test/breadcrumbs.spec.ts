import {
  getBreadcrumbsForPath,
  LEGACY_FMS_BREADCRUMB_LABEL,
  truncateBreadcrumbLabel,
  usesLegacyHomeAsDashboard
} from "../../web/lib/breadcrumbs";
import { LEGACY_FMS_HOME_PATH } from "../../web/lib/role-redirect";

describe("breadcrumb helpers", () => {
  it("maps known list routes to static labels", () => {
    expect(getBreadcrumbsForPath("/work-orders")).toEqual([{ label: "Work Orders" }]);
    expect(getBreadcrumbsForPath("/inventory")).toEqual([{ label: "Inventory" }]);
    expect(getBreadcrumbsForPath("/system-health")).toEqual([{ label: "System Health" }]);
    expect(getBreadcrumbsForPath("/admin")).toEqual([{ label: "Admin Console" }]);
    expect(getBreadcrumbsForPath("/admin/users")).toEqual([
      { label: "Admin Console", href: "/admin" },
      { label: "Users & Access" }
    ]);
    expect(getBreadcrumbsForPath("/admin/tenants")).toEqual([
      { label: "Admin Console", href: "/admin" },
      { label: "Tenants" }
    ]);
  });

  it("maps vehicle detail and documents routes with parent links", () => {
    expect(getBreadcrumbsForPath("/vehicles/veh-123")).toEqual([
      { label: "Vehicles", href: "/vehicles" },
      { label: "Vehicle Details" }
    ]);

    expect(getBreadcrumbsForPath("/vehicles/veh-123/documents")).toEqual([
      { label: "Vehicles", href: "/vehicles" },
      { label: "Vehicle Details", href: "/vehicles/veh-123" },
      { label: "Documents" }
    ]);
  });

  it("maps report module routes under Reports", () => {
    expect(getBreadcrumbsForPath("/reports/operations")).toEqual([
      { label: "Reports", href: "/reports" },
      { label: "Operations" }
    ]);
  });

  it("labels legacy /home as Legacy FMS Archive, not Dashboard Home", () => {
    expect(getBreadcrumbsForPath(LEGACY_FMS_HOME_PATH)).toEqual([
      { label: LEGACY_FMS_BREADCRUMB_LABEL }
    ]);
    expect(usesLegacyHomeAsDashboard(getBreadcrumbsForPath(LEGACY_FMS_HOME_PATH))).toBe(false);
  });

  it("does not treat /home as the primary dashboard breadcrumb", () => {
    const dashboardCrumbs = getBreadcrumbsForPath("/dashboard");
    expect(dashboardCrumbs).toEqual([{ label: "Dashboard" }]);
    expect(dashboardCrumbs.some((item) => item.href === LEGACY_FMS_HOME_PATH)).toBe(false);
    expect(dashboardCrumbs.some((item) => item.label === "Home")).toBe(false);
  });

  it("truncates long labels without throwing", () => {
    const longLabel = "x".repeat(120);
    expect(truncateBreadcrumbLabel(longLabel).length).toBeLessThanOrEqual(48);
    expect(() => getBreadcrumbsForPath("/reports/operations")).not.toThrow();
  });

  it("returns empty array for unmapped routes", () => {
    expect(getBreadcrumbsForPath("/settings/profile")).toEqual([]);
  });
});
