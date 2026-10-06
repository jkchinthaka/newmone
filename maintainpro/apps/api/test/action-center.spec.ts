import {
  actionCenterIsReadOnly,
  actionCenterShowsInventory,
  actionCenterShowsInvitations,
  actionCenterShowsSystemHealth,
  actionCenterShowsWorkOrders,
  buildActionCenterSections,
  buildMorningBriefingLines,
  getActionCenterTitle,
  morningBriefingSupported,
  resolveActionCenterVariant,
  type ActionCenterSnapshot
} from "../../web/lib/action-center";

function baseSnapshot(overrides: Partial<ActionCenterSnapshot> = {}): ActionCenterSnapshot {
  return {
    variant: "admin",
    roleName: "ADMIN",
    permissions: ["inventory.manage", "purchase_orders.view", "reports.view"],
    connections: {
      workOrders: true,
      inventory: true,
      systemHealth: true,
      invitations: true,
      facilityIssues: false
    },
    workOrders: {
      open: 3,
      inProgress: 2,
      overdue: 1,
      highPriority: 2
    },
    inventory: {
      lowStockCount: 4,
      criticalCount: 1,
      pendingPurchaseOrders: 2
    },
    systemHealth: {
      status: "operational",
      failed: 0,
      degraded: 0,
      requiredAttention: 0
    },
    invitations: {
      pending: 1,
      expired: 0
    },
    ...overrides
  };
}

describe("action center role helpers", () => {
  it("maps roles to dashboard-compatible variants", () => {
    expect(resolveActionCenterVariant("ADMIN")).toBe("admin");
    expect(resolveActionCenterVariant("MANAGER")).toBe("management");
    expect(resolveActionCenterVariant("TECHNICIAN")).toBe("technician");
    expect(resolveActionCenterVariant("INVENTORY_KEEPER")).toBe("inventory");
  });

  it("scopes admin-only sections correctly", () => {
    expect(actionCenterShowsSystemHealth("admin")).toBe(true);
    expect(actionCenterShowsSystemHealth("management")).toBe(false);
    expect(actionCenterShowsInvitations("ADMIN")).toBe(true);
    expect(actionCenterShowsInvitations("MANAGER")).toBe(false);
  });

  it("scopes work order and inventory sections by variant", () => {
    expect(actionCenterShowsWorkOrders("technician")).toBe(true);
    expect(actionCenterShowsWorkOrders("driver")).toBe(false);
    expect(actionCenterShowsInventory("inventory", "INVENTORY_KEEPER", ["inventory.manage"])).toBe(true);
    expect(actionCenterShowsInventory("technician")).toBe(false);
  });

  it("marks viewer and minimal variants as read-only", () => {
    expect(actionCenterIsReadOnly("viewer")).toBe(true);
    expect(actionCenterIsReadOnly("minimal")).toBe(true);
    expect(actionCenterIsReadOnly("admin")).toBe(false);
  });
});

describe("action center section builders", () => {
  it("builds admin sections from live snapshot data", () => {
    const sections = buildActionCenterSections(baseSnapshot());
    const ids = sections.map((section) => section.id);

    expect(ids).toEqual(
      expect.arrayContaining(["system-health", "admin-security", "work-orders", "inventory", "invitations", "reports"])
    );
  });

  it("shows not-connected empty states when connections fail", () => {
    const sections = buildActionCenterSections(
      baseSnapshot({
        connections: {
          workOrders: false,
          inventory: false,
          systemHealth: false,
          invitations: false,
          facilityIssues: false
        },
        workOrders: null,
        inventory: null,
        systemHealth: null,
        invitations: null
      })
    );

    const workOrders = sections.find((section) => section.id === "work-orders");
    expect(workOrders?.emptyTitle).toBe("Not connected yet");
  });

  it("opens overdue and high-priority cards on the matching work-order queues", () => {
    const sections = buildActionCenterSections(baseSnapshot());
    const workOrders = sections.find((section) => section.id === "work-orders");
    expect(workOrders?.items.find((item) => item.id === "overdue-work")?.href).toBe("/work-orders?queue=overdue");
    expect(workOrders?.items.find((item) => item.id === "priority-work")?.href).toBe(
      "/work-orders?queue=high-priority"
    );
  });

  it("shows a zero facility issue count from the facility reports destination", () => {
    const sections = buildActionCenterSections(
      baseSnapshot({
        roleName: "ADMIN",
        connections: {
          workOrders: true,
          inventory: true,
          systemHealth: true,
          invitations: true,
          facilityIssues: true
        },
        facilityIssues: { open: 0, inProgress: 0, critical: 0 }
      })
    );
    const clear = sections.find((section) => section.id === "facility")?.items.find((item) => item.id === "facility-issues-clear");
    expect(clear?.metricValue).toBe("0");
    expect(clear?.href).toBe("/facilities/reports");
  });

  it("builds technician assigned work section metrics", () => {
    const sections = buildActionCenterSections(
      baseSnapshot({
        variant: "technician",
        roleName: "TECHNICIAN",
        workOrders: {
          open: 1,
          inProgress: 1,
          overdue: 0,
          highPriority: 1,
          assigned: 2
        },
        systemHealth: undefined,
        invitations: undefined
      })
    );

    const workOrders = sections.find((section) => section.id === "work-orders");
    expect(workOrders?.items.some((item) => item.id === "assigned-work")).toBe(true);
  });

  it("does not invent fake metrics in morning briefing", () => {
    const lines = buildMorningBriefingLines(baseSnapshot());
    expect(lines.some((line) => line.label === "Overdue")).toBe(true);
    expect(lines.some((line) => line.value === "4" && line.label === "Low-stock parts")).toBe(true);
  });

  it("supports morning briefing only for admin, management, and inventory variants", () => {
    expect(morningBriefingSupported("admin")).toBe(true);
    expect(morningBriefingSupported("management")).toBe(true);
    expect(morningBriefingSupported("inventory")).toBe(true);
    expect(morningBriefingSupported("technician")).toBe(false);
  });

  it("links facility section to live hierarchy route", () => {
    const sections = buildActionCenterSections(
      baseSnapshot({
        variant: "management",
        roleName: "FACILITY_MANAGER",
        connections: {
          workOrders: true,
          inventory: true,
          systemHealth: false,
          invitations: false,
          facilityIssues: false
        },
        facilityIssues: null
      })
    );

    const facility = sections.find((section) => section.id === "facility");
    const hierarchyLink = facility?.items.find((item) => item.id === "facility-hierarchy");

    expect(hierarchyLink?.href).toBe("/facilities");
    expect(hierarchyLink?.title).toBe("Open facility hierarchy");
    expect(facility?.items.some((item) => item.href === "/facilities/reports")).toBe(true);
  });

  it("uses unified Home title for action center variants", () => {
    expect(getActionCenterTitle("technician")).toBe("Home");
    expect(getActionCenterTitle("inventory")).toBe("Home");
  });

  it("never exposes FG Digital Records sections after product removal", () => {
    const withLegacyPermission = buildActionCenterSections(baseSnapshot({ permissions: ["fg.access"] }));
    const without = buildActionCenterSections(baseSnapshot());
    expect(withLegacyPermission.some((section) => section.id === "fg-digital-records")).toBe(false);
    expect(without.some((section) => section.id === "fg-digital-records")).toBe(false);
    expect(
      withLegacyPermission.some((section) => section.items.some((item) => item.href.startsWith("/fg")))
    ).toBe(false);
  });
});
