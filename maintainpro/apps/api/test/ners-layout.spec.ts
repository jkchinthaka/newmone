import ExcelJS from "exceljs";

import { isNelnaOrganization, nersFilename, renderNersPdf, renderNersWorkbook, officialLogoPath } from "../src/modules/reports/ners-layout";

const sample = {
  title: "Asset Register Report",
  organizationName: "Nelna Farm (Pvt) Ltd",
  generatedAt: new Date("2026-10-16T04:30:00.000Z"),
  generatedBy: "admin@maintainpro.local",
  period: "2026-10-01 to 2026-10-16",
  filters: [{ label: "Status", value: "ACTIVE" }],
  kpis: [{ label: "Assets", value: "2" }],
  columns: [
    { key: "tag", label: "Asset tag" },
    { key: "cost", label: "Cost", type: "currency" as const }
  ],
  rows: [
    { tag: "AST-1001", cost: 1250.5 },
    { tag: "=CMD", cost: 10 }
  ],
  coverageNotes: ["Costs exclude purchase orders."],
  truncatedNote: null,
  logoPath: officialLogoPath()
};

describe("NERS 2026 layout", () => {
  it("names files for Nelna and keeps another tenant off the Nelna mark", () => {
    expect(nersFilename("Work Order Summary", "pdf", new Date("2026-10-16T12:00:00.000Z"))).toMatch(
      /^NELNA_Work_Order_Summary_2026-10-16\.pdf$/
    );
    expect(isNelnaOrganization("Other Company")).toBe(false);
    expect(isNelnaOrganization("Nelna Farm (Pvt) Ltd")).toBe(true);
  });

  it("writes a PDF with the official logo and a smaller file without it", async () => {
    const pdf = await renderNersPdf(sample);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(sample.logoPath).toBeTruthy();
    const other = await renderNersPdf({ ...sample, organizationName: "Other Company", logoPath: officialLogoPath() });
    expect(other.subarray(0, 5).toString()).toBe("%PDF-");
    expect(other.length).toBeLessThan(pdf.length);
  });

  it("writes an editable workbook with summary, data, filters, and a neutralized formula", async () => {
    const buffer = await renderNersWorkbook(sample);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Summary", "Data", "Filters"]);
    const data = workbook.getWorksheet("Data");
    expect(data?.getRow(1).getCell(1).value).toBe("Asset tag");
    expect(data?.getRow(2).getCell(2).value).toBe(1250.5);
    expect(String(data?.getRow(3).getCell(1).value)).toMatch(/^'/);
    expect((data?.views?.[0] as { ySplit?: number } | undefined)?.ySplit).toBe(1);
  });
});
