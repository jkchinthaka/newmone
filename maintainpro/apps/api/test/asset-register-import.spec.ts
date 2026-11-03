import ExcelJS from "exceljs";

import {
  AssetTagNumberer,
  closestName,
  parseImportDate,
  planAssetImport,
  saveOrder,
  type AssetImportMasterData
} from "../src/modules/assets/asset-register-import";
import { AssetRegisterImportService } from "../src/modules/assets/asset-register-import.service";

const master = (): AssetImportMasterData => ({
  sites: [
    { id: "s1", code: "MP", name: "Main Plant" },
    { id: "s2", code: "KD", name: "Kiridiwela Outlet" }
  ],
  locations: [
    { id: "l1", code: "BH-01", name: "Boiler house", siteId: "s1" },
    { id: "l2", code: "ST-01", name: "Store", siteId: "s2" }
  ],
  departments: [{ id: "d1", code: "ENG", name: "Engineering" }],
  domains: [
    { id: "dm1", code: "PLANT_MACHINERY", name: "Plant & Machinery" },
    { id: "dm2", code: "IT_HARDWARE", name: "IT Hardware" }
  ],
  categories: [
    { id: "c1", code: "MACHINE", name: "Machine", domainId: "dm1", legacyEnum: "MACHINE" },
    { id: "c2", code: "LAPTOP", name: "Laptop", domainId: "dm2", legacyEnum: null }
  ],
  types: [{ id: "t1", code: "GENERIC_MACHINE", name: "Generic Machine", categoryId: "c1" }],
  users: [{ id: "u1", email: "kamal@example.com", name: "Kamal Perera" }],
  existing: [
    { id: "a-old", assetTag: "AST-MCH0007", name: "Old boiler", serialNumber: "SN-OLD", fixedAssetCode: "FA-100", siteId: "s1", functionalLocationId: null }
  ],
  takenTags: ["AST-MCH0007", "AST-MCH0003"]
});

const machine = (overrides: Record<string, unknown> = {}) => ({
  assetGroup: "Plant & Machinery",
  category: "Machine",
  name: "Vacuum filler",
  site: "Main Plant",
  ...overrides
});

describe("asset register import: rows", () => {
  it("resolves names and codes, numbers missing tags after the highest used, and saves as Draft by default", () => {
    const plan = planAssetImport(
      [
        machine({ row: 2, functionalLocation: "BH-01 — Boiler house", department: "engineering", type: "generic machine", responsiblePerson: "kamal@example.com", purchaseDate: "15/03/2024", purchasePrice: "1,250,000" }),
        machine({ row: 3, name: "Laptop 1", assetGroup: "IT Hardware", category: "laptop", site: "kd" })
      ],
      master()
    );
    expect(plan.counts).toEqual({ total: 2, new: 2, update: 0, skip: 0, error: 0 });
    const [first, second] = plan.lines;
    expect(first).toMatchObject({ status: "NEW", assetTag: "AST-MCH0008", autoTag: true });
    expect(first.payload).toMatchObject({
      category: "MACHINE",
      domainId: "dm1",
      categoryMasterId: "c1",
      typeMasterId: "t1",
      siteId: "s1",
      functionalLocationId: "l1",
      departmentId: "d1",
      responsiblePersonId: "u1",
      purchaseDate: "2024-03-15",
      purchasePrice: 1250000,
      status: "DRAFT",
      criticalityLevel: "MEDIUM"
    });
    // IT hardware has no fixed category: equipment prefix.
    expect(second).toMatchObject({ status: "NEW", assetTag: "AST-EQP0001" });
    expect(second.display).toMatchObject({ site: "Kiridiwela Outlet", category: "Laptop" });
  });

  it("keeps a typed tag, checks its format, and never auto-numbers onto it", () => {
    const plan = planAssetImport(
      [machine({ row: 2, assetTag: "ast-mch0008" }), machine({ row: 3, name: "Second" }), machine({ row: 4, name: "Bad", assetTag: "TAG-1" })],
      master()
    );
    expect(plan.lines.map((line) => [line.status, line.assetTag])).toEqual([
      ["NEW", "AST-MCH0008"],
      ["NEW", "AST-MCH0009"],
      ["ERROR", "TAG-1"]
    ]);
    expect(plan.lines[2].messages[0]).toMatch(/AST-MCH0001/);
  });

  it("does not create sites, locations, departments or categories, and suggests the closest name", () => {
    const plan = planAssetImport(
      [machine({ row: 2, site: "Mian Plant", department: "Enginering", functionalLocation: "Boiler hose" }), machine({ row: 3, category: "Laptop" })],
      master()
    );
    expect(plan.lines[0].status).toBe("ERROR");
    expect(plan.lines[0].messages.join(" ")).toContain('Site "Mian Plant" is not in the system. Did you mean "Main Plant"?');
    expect(plan.lines[0].messages.join(" ")).toContain('Did you mean "Engineering"?');
    expect(plan.lines[1].messages).toEqual(['Category "Laptop" is under asset group "IT Hardware", not "Plant & Machinery".']);
  });

  it("asks for the required columns", () => {
    const plan = planAssetImport([{ row: 2 }], master());
    expect(plan.lines[0].messages).toEqual(["Name is missing.", "Asset group is missing.", "Category is missing.", "Site is missing."]);
  });

  it("skips assets already in the system (tag, serial, ERP code) unless updating is ticked", () => {
    const rows = [
      machine({ row: 2, assetTag: "AST-MCH0007" }),
      machine({ row: 3, serialNumber: "sn-old" }),
      machine({ row: 4, fixedAssetCode: "FA-100", site: "Kiridiwela Outlet" })
    ];
    const skipped = planAssetImport(rows, master());
    expect(skipped.lines.map((line) => line.status)).toEqual(["SKIP", "ERROR", "ERROR"]);
    expect(skipped.lines[0].messages[0]).toBe("Already in the system as AST-MCH0007 (same asset tag).");
    // The same asset twice in one file is an error, not two updates.
    expect(skipped.lines[1].messages).toEqual(["Row 2 is the same asset (AST-MCH0007)."]);
    expect(skipped.lines[2].messages).toEqual(["Row 2 is the same asset (AST-MCH0007)."]);

    const updated = planAssetImport([machine({ row: 2, serialNumber: "SN-OLD", site: "Kiridiwela Outlet", status: "Active" })], master(), { updateExisting: true });
    expect(updated.lines[0]).toMatchObject({ status: "UPDATE", assetTag: "AST-MCH0007", existingAssetId: "a-old" });
    expect(updated.lines[0].warnings.join(" ")).toMatch(/Move/);
    expect(updated.lines[0].warnings.join(" ")).toMatch(/Status is not changed/);
  });

  it("refuses a serial or tag that is already used by a different asset tag", () => {
    const plan = planAssetImport([machine({ row: 2, assetTag: "AST-MCH0100", serialNumber: "SN-OLD" })], master(), { updateExisting: true });
    expect(plan.lines[0].status).toBe("ERROR");
    expect(plan.lines[0].messages[0]).toBe("This serial number belongs to AST-MCH0007 in the system, but the row says AST-MCH0100.");
  });

  it("finds duplicates inside the file", () => {
    const plan = planAssetImport(
      [machine({ row: 2, assetTag: "AST-MCH0100", serialNumber: "X1" }), machine({ row: 3, assetTag: "AST-MCH0100", serialNumber: "x1" })],
      master()
    );
    expect(plan.lines[1].messages).toEqual(["Asset tag AST-MCH0100 is also on row 2.", "Serial number x1 is also on row 2."]);
  });

  it("links parents in the system or earlier/later in the file, saves parents first, and stops loops", () => {
    const plan = planAssetImport(
      [
        machine({ row: 2, name: "Motor", assetTag: "AST-MCH0201", parentAssetTag: "AST-MCH0200" }),
        machine({ row: 3, name: "Line 2", assetTag: "AST-MCH0200" }),
        machine({ row: 4, name: "Gearbox", parentAssetTag: "AST-MCH0007" }),
        machine({ row: 5, name: "Ghost child", parentAssetTag: "AST-MCH9999" }),
        machine({ row: 6, name: "Loop A", assetTag: "AST-MCH0300", parentAssetTag: "AST-MCH0301" }),
        machine({ row: 7, name: "Loop B", assetTag: "AST-MCH0301", parentAssetTag: "AST-MCH0300" })
      ],
      master()
    );
    expect(plan.lines[0].parentRowTag).toBe("AST-MCH0200");
    expect(plan.lines[2].payload?.parentAssetId).toBe("a-old");
    expect(plan.lines[3].messages).toEqual(["Parent asset AST-MCH9999 is not in the system or in this file."]);
    expect(plan.lines[4].status).toBe("ERROR");
    expect(plan.lines[5].status).toBe("ERROR");
    expect(saveOrder(plan.lines).map((line) => line.row).slice(0, 2)).toEqual([3, 2]);
  });

  it("a system-numbered tag sent again for the same asset is treated as that asset (no duplicate on retry)", () => {
    const data = master();
    data.existing.push({ id: "a-new", assetTag: "AST-MCH0008", name: "Vacuum filler", serialNumber: null, fixedAssetCode: null, siteId: "s1", functionalLocationId: null });
    data.takenTags.push("AST-MCH0008");
    const plan = planAssetImport([machine({ row: 2, assetTag: "AST-MCH0008", autoTag: true }), machine({ row: 3, name: "Other", assetTag: "AST-MCH0008", autoTag: true })], data);
    expect(plan.lines[0]).toMatchObject({ status: "SKIP", existingAssetId: "a-new" });
    // A different asset whose suggested tag was taken meanwhile gets the next free number.
    expect(plan.lines[1]).toMatchObject({ status: "NEW", assetTag: "AST-MCH0009", autoTag: true });
  });

  it("reads dates in both orders and refuses impossible ones", () => {
    expect(parseImportDate("2024-03-15")).toEqual({ value: "2024-03-15" });
    expect(parseImportDate("15/03/2024")).toEqual({ value: "2024-03-15" });
    expect(parseImportDate("31/02/2024")).toEqual({ invalid: true });
    expect(parseImportDate("soon")).toEqual({ invalid: true });
    expect(closestName("Kiridiwela", master().sites)).toBe("Kiridiwela Outlet");
    expect(new AssetTagNumberer(["AST-TOL0002"]).take("TOOL")).toBe("AST-TOL0003");
  });
});

function servicePrisma() {
  const data = master();
  const assetFindMany = jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
    if (where.OR) return Promise.resolve(data.takenTags.map((assetTag) => ({ assetTag })));
    return Promise.resolve(data.existing.filter((asset) => {
      const tags = (where.assetTag as { in?: string[] } | undefined)?.in;
      const serials = (where.serialNumber as { in?: string[] } | undefined)?.in;
      return (tags && tags.includes(asset.assetTag)) || (serials && serials.includes(asset.serialNumber ?? ""));
    }));
  });
  return {
    site: { findMany: jest.fn().mockResolvedValue(data.sites) },
    functionalLocation: { findMany: jest.fn().mockResolvedValue(data.locations) },
    department: { findMany: jest.fn().mockResolvedValue(data.departments) },
    assetDomain: { findMany: jest.fn().mockResolvedValue(data.domains) },
    assetCategoryMaster: { findMany: jest.fn().mockResolvedValue(data.categories) },
    assetTypeMaster: { findMany: jest.fn().mockResolvedValue(data.types) },
    user: { findMany: jest.fn().mockResolvedValue([{ id: "u1", email: "kamal@example.com", firstName: "Kamal", lastName: "Perera" }]) },
    asset: { findMany: assetFindMany },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
}

describe("asset register import: save", () => {
  const actor = { sub: "admin-1", tenantId: "t1", role: "ADMIN" };

  it("creates parents before children, updates when ticked, and reports each row", async () => {
    const prisma = servicePrisma();
    const assets = {
      create: jest.fn().mockImplementation((_tenant: string, _actor: string, body: { assetTag: string }) =>
        Promise.resolve({ id: `id-${body.assetTag}`, assetTag: body.assetTag })
      ),
      update: jest.fn().mockResolvedValue({})
    };
    const service = new AssetRegisterImportService(prisma as never, assets as never);
    const result = await service.save(
      actor as never,
      [
        machine({ row: 2, name: "Motor", assetTag: "AST-MCH0201", parentAssetTag: "AST-MCH0200" }),
        machine({ row: 3, name: "Line 2", assetTag: "AST-MCH0200" }),
        machine({ row: 4, name: "Old boiler", serialNumber: "SN-OLD", manufacturer: "Cochran" }),
        machine({ row: 5, name: "Broken", site: "Nowhere" })
      ],
      { updateExisting: true }
    );
    expect(assets.create.mock.calls.map((call) => call[2].assetTag)).toEqual(["AST-MCH0200", "AST-MCH0201"]);
    expect(assets.create.mock.calls[1][2]).toMatchObject({ parentAssetId: "id-AST-MCH0200", status: "DRAFT", siteId: "s1" });
    expect(assets.update).toHaveBeenCalledWith("a-old", "t1", "admin-1", expect.objectContaining({ manufacturer: "Cochran", name: "Old boiler" }));
    // Update leaves tag, site, location and status alone.
    expect(assets.update.mock.calls[0][3]).not.toHaveProperty("siteId");
    expect(assets.update.mock.calls[0][3]).not.toHaveProperty("status");
    expect(assets.update.mock.calls[0][3]).not.toHaveProperty("assetTag");
    expect(result.counts).toEqual({ created: 2, updated: 1, skipped: 0, errors: 1 });
    expect(result.results.map((row) => [row.row, row.status])).toEqual([
      [2, "CREATED"],
      [3, "CREATED"],
      [4, "UPDATED"],
      [5, "ERROR"]
    ]);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("refuses an empty file and a part bigger than the save size", async () => {
    const service = new AssetRegisterImportService(servicePrisma() as never, {} as never);
    await expect(service.save(actor as never, [])).rejects.toThrow(/no asset rows/);
    await expect(service.save(actor as never, Array.from({ length: 201 }, () => machine()))).rejects.toThrow(/up to 200/);
    await expect(service.preview(actor as never, Array.from({ length: 2001 }, () => machine()))).rejects.toThrow(/up to 2000/);
  });

  it("builds a template with drop-downs from this company's lists", async () => {
    const service = new AssetRegisterImportService(servicePrisma() as never, {} as never);
    const buffer = await service.template(actor as never);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Assets", "Lists", "Groups and categories", "Sites and locations", "How to fill"]);
    const header = workbook.getWorksheet("Assets")!.getRow(1).values as unknown[];
    expect(header.slice(1, 6)).toEqual(["Asset group *", "Category *", "Type", "Name *", "Site *"]);
    const lists = workbook.getWorksheet("Lists")!;
    expect(lists.getColumn(4).values.slice(1)).toEqual(["Site", "Kiridiwela Outlet", "Main Plant"]);
    const model = (workbook.getWorksheet("Assets") as unknown as { dataValidations: { model: Record<string, { formulae: string[] }> } }).dataValidations.model;
    expect(Object.values(model).some((rule) => rule.formulae[0] === "Lists!$D$2:$D$3")).toBe(true);
  });
});
