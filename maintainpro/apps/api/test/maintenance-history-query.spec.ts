import {
  buildMaintenanceHistoryWhere,
  historyStatuses,
  parseMaintenanceHistoryQuery,
  toMaintenanceHistoryItem
} from "../src/modules/work-orders/maintenance-history.query";

describe("maintenance history query", () => {
  const base = {
    tenantId: "tenant-1",
    role: "MANAGER",
    userId: "user-1"
  };

  it("lists completed and closed work and rejects open statuses", () => {
    expect(historyStatuses(undefined)).toEqual(["COMPLETED", "CLOSED"]);
    expect(historyStatuses("OPEN")).toEqual(["COMPLETED", "CLOSED"]);
    expect(historyStatuses("CANCELLED")).toEqual(["CANCELLED"]);
    const where = buildMaintenanceHistoryWhere({
      ...base,
      query: parseMaintenanceHistoryQuery({}),
      statuses: historyStatuses(undefined)
    });
    expect(where.status).toEqual({ in: ["COMPLETED", "CLOSED"] });
    expect(JSON.stringify(where)).not.toContain("OPEN");
    expect(JSON.stringify(where)).not.toContain("IN_PROGRESS");
  });

  it("sends search, asset scope, date, category, and page size to the query", () => {
    const query = parseMaintenanceHistoryQuery({
      q: "pump",
      scope: "vehicle",
      from: "2026-01-01",
      to: "2026-01-31",
      category: "Electrical",
      page: "3",
      pageSize: "100",
      status: "COMPLETED"
    });
    expect(query.page).toBe(3);
    expect(query.pageSize).toBe(100);
    expect(parseMaintenanceHistoryQuery({ pageSize: "15" }).pageSize).toBe(25);
    const where = buildMaintenanceHistoryWhere({
      ...base,
      query,
      statuses: historyStatuses(query.status)
    });
    expect(where.vehicleId).toEqual({ not: null });
    expect(where.categoryNameSnapshot).toEqual({ contains: "Electrical" });
    expect(where.status).toEqual({ in: ["COMPLETED"] });
    const serialized = JSON.stringify(where);
    expect(serialized).toContain("pump");
    expect(serialized).toContain("woNumber");
    expect(serialized).toContain("registrationNo");
    expect(serialized).toContain("completedDate");
    expect(serialized).toContain("\"not\":\"CANCELLED\"");
    expect(where.status).toEqual({ in: ["COMPLETED"] });
  });

  it("keeps a cancelled date off the completed date and scopes technicians to their own jobs", () => {
    const item = toMaintenanceHistoryItem({
      id: "wo-1",
      woNumber: "WO-1",
      title: "Replace belt",
      status: "CANCELLED",
      type: "CORRECTIVE",
      categoryNameSnapshot: "Mechanical",
      completedDate: new Date("2026-02-01T00:00:00.000Z"),
      closedAt: null,
      repairCompletedAt: null,
      actualCost: null,
      asset: { name: "Pump", assetTag: "AST-0001" },
      vehicle: null,
      technician: { firstName: "Ada", lastName: "Lovelace" },
      assignees: [],
      vendorSupplier: null
    });
    expect(item.finalizedAt).toBeNull();
    expect(item.assetLabel).toBe("Pump");
    expect(item.category).toBe("Mechanical");
    expect(item.technician).toBe("Ada Lovelace");

    const completed = toMaintenanceHistoryItem({
      ...{
        id: "wo-2",
        woNumber: "WO-2",
        title: "Service",
        status: "CLOSED",
        type: "PREVENTIVE",
        categoryNameSnapshot: null,
        completedDate: null,
        closedAt: new Date("2026-03-02T00:00:00.000Z"),
        repairCompletedAt: null,
        actualCost: { toString: () => "12.50" },
        asset: null,
        vehicle: { registrationNo: "ABC-123" },
        technician: null,
        assignees: [{ employee: { fullName: "Grace Hopper" } }],
        vendorSupplier: { name: "Yard" }
      }
    });
    expect(completed.finalizedAt).toBe("2026-03-02T00:00:00.000Z");
    expect(completed.cost).toBe(12.5);
    expect(completed.technician).toBe("Grace Hopper");
    expect(completed.assetLabel).toBe("ABC-123");

    const scoped = buildMaintenanceHistoryWhere({
      ...base,
      role: "TECHNICIAN",
      query: parseMaintenanceHistoryQuery({}),
      statuses: historyStatuses("CANCELLED")
    });
    expect(JSON.stringify(scoped)).toContain("user-1");
    expect(scoped.status).toEqual({ in: ["CANCELLED"] });

    const cancelledRange = buildMaintenanceHistoryWhere({
      ...base,
      query: parseMaintenanceHistoryQuery({ status: "CANCELLED", from: "2026-01-01", to: "2026-01-31", costMin: "" }),
      statuses: historyStatuses("CANCELLED")
    });
    const cancelledText = JSON.stringify(cancelledRange);
    expect(cancelledText).toContain("updatedAt");
    expect(cancelledText).not.toContain("completedDate");
    expect(parseMaintenanceHistoryQuery({ costMin: "" }).costMin).toBeUndefined();
  });
});
