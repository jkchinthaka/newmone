import {
  breakdownHasRows,
  formatFacilityDashboardCount,
  hasFacilityDashboardData
} from "../../web/lib/facility-dashboard";
import { canViewFacilityReports } from "../../web/lib/facilities";
import { getVisibleNavigationItems } from "../../web/lib/navigation";

describe("facility dashboard web helpers", () => {
  it("formats counts without inventing placeholder metrics", () => {
    expect(formatFacilityDashboardCount(0)).toBe("0");
    expect(formatFacilityDashboardCount(null)).toBe("—");
  });

  it("detects empty tenant summary safely", () => {
    expect(
      hasFacilityDashboardData({
        hierarchy: { propertyCount: 0, roomCount: 0 },
        issues: { totalIssueCount: 0 }
      })
    ).toBe(false);
    expect(
      hasFacilityDashboardData({
        hierarchy: { propertyCount: 1, roomCount: 0 },
        issues: { totalIssueCount: 0 }
      })
    ).toBe(true);
  });

  it("hides breakdown sections when all counts are zero", () => {
    expect(breakdownHasRows([{ key: "OPEN", label: "Open", count: 0 }])).toBe(false);
    expect(breakdownHasRows([{ key: "OPEN", label: "Open", count: 2 }])).toBe(true);
  });

  it("allows facility reports for view roles and blocks drivers", () => {
    expect(canViewFacilityReports("FACILITY_MANAGER", [])).toBe(true);
    expect(canViewFacilityReports("VIEWER", [])).toBe(true);
    expect(canViewFacilityReports("DRIVER", [])).toBe(false);
  });

  it("does not expose facility reports as top-level navigation (Phase 1)", () => {
    const facilityManagerItems = getVisibleNavigationItems("FACILITY_MANAGER");
    const driverItems = getVisibleNavigationItems("DRIVER");

    expect(facilityManagerItems.some((item) => item.href === "/facilities/reports")).toBe(false);
    expect(facilityManagerItems.some((item) => item.href === "/assets")).toBe(true);
    expect(driverItems.some((item) => item.href === "/facilities/reports")).toBe(false);
  });
});
