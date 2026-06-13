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
      degraded: 0
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
    expect(actionCenterShowsInventory("inventory")).toBe(true);
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

  it("uses role-specific action center titles", () => {
    expect(getActionCenterTitle("technician")).toBe("My Action Center");
    expect(getActionCenterTitle("inventory")).toBe("Inventory Action Center");
  });
});
