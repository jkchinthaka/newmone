import {
  dataTableMobileCardIncludesActions,
  getVisibleMobileColumns
} from "../../web/lib/data-table-mobile";
import {
  LEGACY_PWA_BRAND_MARKERS,
  PWA_DESCRIPTION,
  PWA_ICON_PATHS,
  PWA_NAME,
  PWA_SHORT_NAME,
  PWA_START_URL,
  PWA_THEME_COLOR
} from "../../web/lib/pwa-metadata";
import { truncateBreadcrumbLabel } from "../../web/lib/breadcrumbs";

describe("mobile and PWA polish helpers", () => {
  it("filters hidden mobile columns for DataTable cards", () => {
    const columns = [
      { id: "name", hideOnMobile: false },
      { id: "notes", hideOnMobile: true },
      { id: "status", hideOnMobile: false }
    ];

    expect(getVisibleMobileColumns(columns).map((column) => column.id)).toEqual(["name", "status"]);
  });

  it("keeps action slots available on mobile cards when configured", () => {
    expect(dataTableMobileCardIncludesActions(true)).toBe(true);
    expect(dataTableMobileCardIncludesActions(false)).toBe(false);
  });

  it("truncates long breadcrumb labels without throwing", () => {
    const longLabel = "Asset registry export for northern region maintenance team".repeat(3);
    expect(truncateBreadcrumbLabel(longLabel).length).toBeLessThanOrEqual(48);
  });

  it("uses MaintainPro branding in PWA metadata", () => {
    expect(PWA_NAME).toBe("MaintainPro");
    expect(PWA_SHORT_NAME).toBe("MaintainPro");
    expect(PWA_DESCRIPTION).toBe("Enterprise Maintenance & Facility Operations Platform");
    expect(PWA_START_URL).toBe("/splash");
    expect(PWA_THEME_COLOR).toBe("#0f172a");
    expect(PWA_ICON_PATHS.icon192).toBe("/pwa-192x192.svg");
    expect(PWA_ICON_PATHS.icon512).toBe("/pwa-512x512.svg");
  });

  it("does not retain legacy primary branding markers in PWA metadata", () => {
    const serialized = JSON.stringify({
      name: PWA_NAME,
      shortName: PWA_SHORT_NAME,
      description: PWA_DESCRIPTION
    });

    for (const marker of LEGACY_PWA_BRAND_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });
});
