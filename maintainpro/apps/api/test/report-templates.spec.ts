import { OPERATIONS_COMPLETION_RATE_DEFINITION, validateReportTemplate } from "../src/modules/reports/report-kpi";

describe("report templates", () => {
  it("keeps the operations completion-rate definition explicit", () => {
    expect(OPERATIONS_COMPLETION_RATE_DEFINITION).toContain("COMPLETED");
    expect(OPERATIONS_COMPLETION_RATE_DEFINITION).toContain("created in the selected date range");
    expect(OPERATIONS_COMPLETION_RATE_DEFINITION).toContain("CLOSED");
  });

  it("accepts a mapped template and rejects unsafe content and unknown columns", () => {
    const saved = validateReportTemplate({
      name: "Vehicle maintenance cost",
      reportType: "operations",
      description: "Closed vehicle jobs",
      columns: ["woNumber", "status"],
      exportFormat: "xlsx",
      defaultStatus: "CLOSED"
    });
    expect(saved.exportFormat).toBe("xlsx");
    expect(saved.columns).toEqual(["woNumber", "status"]);
    expect(() =>
      validateReportTemplate({
        name: "Bad",
        reportType: "operations",
        columns: ["woNumber"],
        description: "<script>alert(1)</script>"
      })
    ).toThrow(/unsupported template content/);
    expect(() =>
      validateReportTemplate({
        name: "Bad column",
        reportType: "operations",
        columns: ["secretSql"]
      })
    ).toThrow(/field list/);
    expect(() =>
      validateReportTemplate({
        name: "drop table WorkOrder",
        reportType: "operations",
        columns: ["woNumber"]
      })
    ).toThrow(/unsupported template content/);
  });

  it("accepts each report type's own columns and rejects another type's fields", () => {
    expect(
      validateReportTemplate({
        name: "Asset downtime",
        reportType: "assets",
        columns: ["identifier", "downtimeHours", "cost"]
      }).columns
    ).toEqual(["identifier", "downtimeHours", "cost"]);
    expect(
      validateReportTemplate({
        name: "Technician output",
        reportType: "performance",
        columns: ["technician", "productivity"]
      }).sortBy
    ).toBe("technician");
    expect(
      validateReportTemplate({
        name: "Spend",
        reportType: "financials",
        columns: ["date", "amount"],
        sortBy: "amount"
      }).sortBy
    ).toBe("amount");
    expect(() =>
      validateReportTemplate({
        name: "Wrong fields",
        reportType: "assets",
        columns: ["woNumber"]
      })
    ).toThrow(/field list/);
  });
});
