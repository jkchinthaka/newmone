import ExcelJS from "exceljs";

import { enumFromText, placesSaveOrder, planPlacesImport } from "../src/modules/organization/places-import";
import { PlacesImportService } from "../src/modules/organization/places-import.service";

const existing = () => ({
  sites: [
    { id: "s1", code: "HO", name: "Head Office", isActive: true, type: "OFFICE" },
    { id: "s2", code: "OLD", name: "Closed farm", isActive: false }
  ],
  locations: [{ id: "l1", siteId: "s1", code: "BLD-A", name: "Building A", isActive: true }]
});

describe("sites and locations import: rows", () => {
  it("reads friendly type names", () => {
    expect(enumFromText("Production line", ["AREA", "PRODUCTION_LINE"] as const)).toBe("PRODUCTION_LINE");
    expect(enumFromText("farm area", ["FARM_AREA"] as const)).toBe("FARM_AREA");
    expect(enumFromText("Spaceship", ["AREA"] as const)).toBeNull();
  });

  it("creates a new site once, its locations, and matches existing sites by code", () => {
    const plan = planPlacesImport(
      [
        { row: 2, siteCode: "mp", siteName: "Main Plant", siteType: "Factory", locationCode: "BH 01", locationName: "Boiler house", locationType: "Building" },
        { row: 3, siteCode: "MP", siteName: "Main Plant", locationCode: "BH-01-R1", locationName: "Pump room", locationType: "Room", parentLocationCode: "bh-01" },
        { row: 4, siteCode: "HO", siteName: "Head Office", locationCode: "BLD-A-F1", locationName: "First floor", locationType: "Floor", parentLocationCode: "BLD-A" },
        { row: 5, siteCode: "HO", siteName: "Head Office", locationCode: "BLD-A", locationName: "Building A" },
        { row: 6, siteCode: "KD", siteName: "Kiridiwela Outlet", siteType: "Outlet" }
      ],
      existing()
    );
    expect(plan.lines.map((line) => [line.row, line.status, line.creates.site, line.creates.location])).toEqual([
      [2, "NEW", true, true],
      [3, "NEW", false, true],
      [4, "NEW", false, true],
      [5, "SKIP", false, false],
      [6, "NEW", true, false]
    ]);
    expect(plan.lines[0].site).toMatchObject({ code: "MP", type: "FACTORY", isNew: true });
    expect(plan.lines[0].location).toMatchObject({ code: "BH-01", type: "BUILDING" });
    expect(plan.lines[2].location?.parentExistingId).toBe("l1");
    // An existing site shows its own type, not the file's or the default.
    expect(plan.lines[2].site).toMatchObject({ code: "HO", type: "OFFICE", isNew: false });
    expect(plan.lines[3].messages).toEqual(["Location BLD-A is already at site HO."]);
    expect(plan.counts).toEqual({ total: 5, newSites: 2, newLocations: 3, skipped: 1, errors: 0 });
  });

  it("explains every problem", () => {
    const plan = planPlacesImport(
      [
        { row: 2, siteName: "No code" },
        { row: 3, siteCode: "NEW" },
        { row: 4, siteCode: "OLD", siteName: "Closed farm" },
        { row: 5, siteCode: "HO", siteName: "Head Office", locationCode: "X1", locationName: "X", locationType: "Spaceship" },
        { row: 6, siteCode: "HO", siteName: "Head Office", locationCode: "X2", locationName: "Room", parentLocationCode: "NOPE" },
        { row: 7, siteCode: "HO", siteName: "Head Office", locationCode: "X3" },
        { row: 8, siteCode: "MP", siteName: "Main Plant" },
        { row: 9, siteCode: "MP", siteName: "Main Plant 2" }
      ],
      existing()
    );
    const messages = plan.lines.map((line) => line.messages.join(" "));
    expect(messages[0]).toBe("Site code is missing.");
    expect(messages[1]).toBe("Site name is missing (needed for a new site).");
    expect(messages[2]).toBe("Site OLD is inactive. Activate it first.");
    expect(messages[3]).toMatch(/Location type "Spaceship" is not in the list/);
    expect(messages[4]).toBe("Parent location NOPE is not at site HO in MaintainPro or in this file.");
    expect(messages[5]).toBe("Location name is missing.");
    expect(messages[7]).toBe('Site MP is called "Main Plant" on row 8. Use one name.');
    expect(plan.counts.errors).toBe(7);
  });

  it("stops duplicate codes and parent loops, and fails children of failed parents", () => {
    const plan = planPlacesImport(
      [
        { row: 2, siteCode: "HO", siteName: "Head Office", locationCode: "A", locationName: "A", parentLocationCode: "B" },
        { row: 3, siteCode: "HO", siteName: "Head Office", locationCode: "B", locationName: "B", parentLocationCode: "A" },
        { row: 4, siteCode: "HO", siteName: "Head Office", locationCode: "C", locationName: "C", locationType: "Bad" },
        { row: 5, siteCode: "HO", siteName: "Head Office", locationCode: "D", locationName: "D", parentLocationCode: "C" },
        { row: 6, siteCode: "HO", siteName: "Head Office", locationCode: "E", locationName: "E" },
        { row: 7, siteCode: "HO", siteName: "Head Office", locationCode: "E", locationName: "E again" }
      ],
      existing()
    );
    expect(plan.lines.map((line) => line.status)).toEqual(["ERROR", "ERROR", "ERROR", "ERROR", "NEW", "ERROR"]);
    expect(plan.lines[0].messages).toContain("Parent location codes go round in a circle.");
    expect(plan.lines[5].messages).toEqual(["Location E at site HO is also on row 6."]);
  });

  it("orders children after their new parents", () => {
    const plan = planPlacesImport(
      [
        { row: 2, siteCode: "HO", siteName: "Head Office", locationCode: "R1", locationName: "Room", parentLocationCode: "F1" },
        { row: 3, siteCode: "HO", siteName: "Head Office", locationCode: "F1", locationName: "Floor", parentLocationCode: "B1" },
        { row: 4, siteCode: "HO", siteName: "Head Office", locationCode: "B1", locationName: "Building" }
      ],
      existing()
    );
    expect(placesSaveOrder(plan.lines).map((line) => line.row)).toEqual([4, 3, 2]);
  });
});

describe("sites and locations import: save and template", () => {
  const actor = { sub: "admin", tenantId: "t1", role: "ADMIN", email: "a@x" };
  const prisma = () => ({
    site: { findMany: jest.fn().mockResolvedValue(existing().sites) },
    functionalLocation: { findMany: jest.fn().mockResolvedValue(existing().locations) }
  });

  it("creates sites first, then locations with their new parents", async () => {
    const organization = {
      createSite: jest.fn().mockImplementation((_t: string, dto: { code: string }) => Promise.resolve({ id: `site-${dto.code}` })),
      createLocation: jest.fn().mockImplementation((_t: string, dto: { code: string }) =>
        dto.code === "BAD" ? Promise.reject(new Error("Location code already exists for this site")) : Promise.resolve({ id: `loc-${dto.code}` })
      )
    };
    const service = new PlacesImportService(prisma() as never, organization as never);
    const result = await service.save(actor as never, [
      { row: 2, siteCode: "MP", siteName: "Main Plant", locationCode: "R1", locationName: "Room", parentLocationCode: "B1" },
      { row: 3, siteCode: "MP", siteName: "Main Plant", locationCode: "B1", locationName: "Building", locationType: "Building" },
      { row: 4, siteCode: "HO", siteName: "Head Office", locationCode: "BAD", locationName: "Bad" },
      { row: 5, siteCode: "HO", siteName: "Head Office", locationCode: "BLD-A", locationName: "Building A" }
    ]);
    expect(organization.createSite).toHaveBeenCalledTimes(1);
    expect(organization.createSite.mock.calls[0][1]).toEqual({ code: "MP", name: "Main Plant", type: "OTHER" });
    expect(organization.createLocation.mock.calls.map((call) => [call[1].code, call[1].parentId, call[1].siteId])).toEqual([
      ["B1", null, "site-MP"],
      ["R1", "loc-B1", "site-MP"],
      ["BAD", null, "s1"]
    ]);
    expect(result.results.map((row) => [row.row, row.status])).toEqual([
      [2, "CREATED"],
      [3, "CREATED"],
      [4, "ERROR"],
      [5, "SKIPPED"]
    ]);
    expect(result.counts).toEqual({ created: 2, skipped: 1, errors: 1 });
  });

  it("refuses empty and oversized files", async () => {
    const service = new PlacesImportService(prisma() as never, {} as never);
    await expect(service.preview(actor as never, [])).rejects.toThrow(/no rows/);
    await expect(service.preview(actor as never, Array.from({ length: 1001 }, () => ({ siteCode: "A" })))).rejects.toThrow(/up to 1000/);
  });

  it("template has the Places sheet, type drop-downs and what is already in MaintainPro", async () => {
    const service = new PlacesImportService(prisma() as never, {} as never);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await service.template(actor as never)) as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Places", "Lists", "Already in MaintainPro", "How to fill"]);
    expect((workbook.getWorksheet("Places")!.getRow(1).values as unknown[]).slice(1)).toEqual([
      "Site code *",
      "Site name *",
      "Site type",
      "Location code",
      "Location name",
      "Location type",
      "Parent location code"
    ]);
    expect(workbook.getWorksheet("Lists")!.getCell(2, 2).value).toBe("Building");
    expect(workbook.getWorksheet("Already in MaintainPro")!.rowCount).toBe(4);
  });
});
