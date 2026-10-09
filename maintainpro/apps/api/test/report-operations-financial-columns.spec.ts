import { RoleName } from "@prisma/client";

import { ReportsService } from "../src/modules/reports/reports.service";

describe("operations report financial columns", () => {
  const order = {
    id: "wo-1",
    woNumber: "WO-1",
    title: "Pump repair",
    status: "COMPLETED",
    priority: "MEDIUM",
    actualCost: 120,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    dueDate: new Date("2026-10-02T00:00:00.000Z"),
    completedDate: new Date("2026-10-03T00:00:00.000Z"),
    startDate: null,
    asset: null,
    vehicle: null,
    technician: null,
    parts: []
  };

  function buildPrisma() {
    const emptyFindMany = () => Promise.resolve([]);
    return {
      user: { findUnique: jest.fn(), findMany: emptyFindMany },
      workOrder: {
        findMany: jest.fn().mockResolvedValue([order]),
        count: jest.fn().mockResolvedValue(1)
      },
      department: { findMany: emptyFindMany },
      driver: { findMany: emptyFindMany },
      asset: { findMany: emptyFindMany },
      vehicle: { findMany: emptyFindMany },
      supplier: { findMany: emptyFindMany },
      sparePart: { findMany: emptyFindMany },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
  }

  async function exportedCsv(role: RoleName, permissions: string[]) {
    const prisma = buildPrisma();
    const service = new ReportsService(prisma as never, {} as never, {} as never, {} as never);
    const file = await service.exportModule(
      { sub: "user-1", email: "user@example.com", role, tenantId: "tenant-1", permissions },
      "operations",
      "csv",
      {}
    );
    return file.buffer.toString("utf8");
  }

  it("omits actual cost from the operations export for a technician", async () => {
    const csv = await exportedCsv(RoleName.TECHNICIAN, ["reports.view", "reports.export", "reports.operations.view"]);
    expect(csv).toContain("WO-1");
    expect(csv).not.toContain("Actual Cost");
    expect(csv).not.toContain("120");
    expect(csv).not.toContain("wo-1");
  });

  it("includes actual cost in the operations export for finance", async () => {
    const csv = await exportedCsv(RoleName.FINANCE, ["reports.view", "reports.export", "reports.financials.view", "reports.operations.view"]);
    expect(csv).toContain("Actual Cost");
    expect(csv).toContain("120");
    expect(csv).not.toContain("wo-1");
  });
});
