import {
  computeWorkOrderDashboardStats,
  dashboardIsReadOnly,
  dashboardShowsAdminSections,
  dashboardShowsDriverIntelligence,
  dashboardShowsInventorySummary,
  dashboardShowsReportsSummary,
  dashboardShowsSystemHealthSummary,
  dashboardShowsWorkOrdersSummary,
  resolveDashboardVariant,
  selectPriorityWorkOrders
} from "../../web/lib/dashboard-roles";

describe("dashboard role grouping", () => {
  it("maps admin roles to the admin dashboard variant", () => {
    expect(resolveDashboardVariant("SUPER_ADMIN")).toBe("admin");
    expect(resolveDashboardVariant("ADMIN")).toBe("admin");
  });

  it("maps operational roles to management, technician, inventory, cleaner, driver, and viewer variants", () => {
    expect(resolveDashboardVariant("MANAGER")).toBe("management");
    expect(resolveDashboardVariant("MAINTENANCE_SUPERVISOR")).toBe("management");
    expect(resolveDashboardVariant("TECHNICIAN")).toBe("technician");
    expect(resolveDashboardVariant("MECHANIC")).toBe("technician");
    expect(resolveDashboardVariant("INVENTORY_KEEPER")).toBe("inventory");
    expect(resolveDashboardVariant("STOREKEEPER")).toBe("inventory");
    expect(resolveDashboardVariant("CLEANER")).toBe("cleaner");
    expect(resolveDashboardVariant("DRIVER")).toBe("driver");
    expect(resolveDashboardVariant("VIEWER")).toBe("viewer");
    expect(resolveDashboardVariant("AUDITOR")).toBe("viewer");
  });

  it("returns minimal dashboard for unknown or missing roles", () => {
    expect(resolveDashboardVariant(null)).toBe("minimal");
    expect(resolveDashboardVariant(undefined)).toBe("minimal");
    expect(resolveDashboardVariant("UNKNOWN_ROLE")).toBe("minimal");
  });

  it("shows admin and system sections only for admin variant", () => {
    expect(dashboardShowsAdminSections("admin")).toBe(true);
    expect(dashboardShowsSystemHealthSummary("admin")).toBe(true);
    expect(dashboardShowsDriverIntelligence("admin")).toBe(true);

    expect(dashboardShowsAdminSections("management")).toBe(false);
    expect(dashboardShowsSystemHealthSummary("management")).toBe(false);
    expect(dashboardShowsDriverIntelligence("management")).toBe(false);
    expect(dashboardShowsSystemHealthSummary("technician")).toBe(false);
  });

  it("shows work order summaries for admin, management, and technician roles", () => {
    expect(dashboardShowsWorkOrdersSummary("admin")).toBe(true);
    expect(dashboardShowsWorkOrdersSummary("management")).toBe(true);
    expect(dashboardShowsWorkOrdersSummary("technician")).toBe(true);
    expect(dashboardShowsWorkOrdersSummary("viewer")).toBe(false);
    expect(dashboardShowsWorkOrdersSummary("driver")).toBe(false);
  });

  it("shows inventory summary for admin and inventory roles only", () => {
    expect(dashboardShowsInventorySummary("admin")).toBe(true);
    expect(dashboardShowsInventorySummary("inventory")).toBe(true);
    expect(dashboardShowsInventorySummary("management")).toBe(false);
  });

  it("shows reports summary for admin, management, and viewer roles", () => {
    expect(dashboardShowsReportsSummary("admin")).toBe(true);
    expect(dashboardShowsReportsSummary("management")).toBe(true);
    expect(dashboardShowsReportsSummary("viewer")).toBe(true);
    expect(dashboardShowsReportsSummary("technician")).toBe(false);
  });

  it("marks viewer and minimal dashboards as read-only focused", () => {
    expect(dashboardIsReadOnly("viewer")).toBe(true);
    expect(dashboardIsReadOnly("minimal")).toBe(true);
    expect(dashboardIsReadOnly("admin")).toBe(false);
  });

  it("computes work order stats and priority ordering from existing work order data", () => {
    const stats = computeWorkOrderDashboardStats(
      [
        { status: "OPEN" },
        { status: "IN_PROGRESS" },
        { status: "OVERDUE", slaBreached: true },
        { status: "COMPLETED" }
      ],
      { assignedUserId: null }
    );

    expect(stats).toEqual({
      total: 4,
      open: 1,
      inProgress: 1,
      overdue: 1,
      completed: 1,
      assigned: undefined
    });

    const assignedStats = computeWorkOrderDashboardStats(
      [
        { status: "OPEN", technicianId: "tech-1" },
        { status: "OPEN", technicianId: "tech-2" }
      ],
      { assignedUserId: "tech-1" }
    );

    expect(assignedStats.total).toBe(1);
    expect(assignedStats.open).toBe(1);

    const priority = selectPriorityWorkOrders([
      { status: "OPEN", priority: "LOW", dueDate: "2026-12-01T00:00:00.000Z", title: "Low", woNumber: "WO-1" },
      { status: "OVERDUE", priority: "HIGH", dueDate: "2026-06-01T00:00:00.000Z", title: "Overdue", woNumber: "WO-2" }
    ]);

    expect(priority[0]?.woNumber).toBe("WO-2");
  });
});
