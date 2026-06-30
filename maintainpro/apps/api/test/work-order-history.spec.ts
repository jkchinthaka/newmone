import { NotFoundException } from "@nestjs/common";

import { WorkOrderHistoryService } from "../src/modules/work-orders/work-order-history.service";

describe("WorkOrderHistoryService", () => {
  const prisma = {
    workOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    maintenanceLog: { findMany: jest.fn() },
    vehicleMeterLog: { findMany: jest.fn() },
    vehicleDocument: { findMany: jest.fn() }
  };

  const service = new WorkOrderHistoryService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty state when work order has no asset or vehicle", async () => {
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      assetId: null,
      vehicleId: null,
      asset: null,
      vehicle: null
    });

    const result = await service.getHistory("wo-1", { sub: "u1", tenantId: "t1" });

    expect(result.hasLinkedTarget).toBe(false);
    expect(result.message).toContain("No asset or vehicle linked");
    expect(result.readOnly).toBe(true);
    expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
  });

  it("returns no history message when linked target has no records", async () => {
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      assetId: "asset-1",
      vehicleId: null,
      asset: {
        id: "asset-1",
        assetTag: "A-100",
        name: "Pump",
        category: "MACHINERY",
        status: "ACTIVE",
        lastServiceDate: null,
        nextServiceDate: null,
        meterReading: null,
        location: "Plant A"
      },
      vehicle: null
    });
    prisma.workOrder.findMany.mockResolvedValue([]);
    prisma.maintenanceLog.findMany.mockResolvedValue([]);

    const result = await service.getHistory("wo-1", { sub: "u1", tenantId: "t1" });

    expect(result.hasLinkedTarget).toBe(true);
    expect(result.message).toContain("No previous maintenance history found");
    expect(result.assetSummary).toMatchObject({ assetTag: "A-100" });
  });

  it("returns previous maintenance and repeat issue warnings", async () => {
    prisma.workOrder.findFirst.mockResolvedValue({
      id: "wo-1",
      assetId: "asset-1",
      vehicleId: null,
      asset: {
        id: "asset-1",
        assetTag: "A-100",
        name: "Pump",
        category: "MACHINERY",
        status: "ACTIVE",
        lastServiceDate: new Date("2026-01-01"),
        nextServiceDate: null,
        meterReading: 1200,
        location: "Plant A"
      },
      vehicle: null
    });

    prisma.workOrder.findMany
      .mockResolvedValueOnce([
        {
          id: "wo-old-1",
          woNumber: "WO-001",
          title: "Pump leak",
          description: "Leak repair",
          type: "CORRECTIVE",
          status: "COMPLETED",
          completedDate: new Date("2026-05-01"),
          actualCost: 500,
          estimatedCost: 450,
          technician: { firstName: "Sam", lastName: "Tech" },
          assignees: [],
          parts: []
        }
      ])
      .mockResolvedValueOnce([
        { type: "CORRECTIVE", title: "Pump leak" },
        { type: "CORRECTIVE", title: "Pump leak" },
        { type: "CORRECTIVE", title: "Pump leak" }
      ]);

    prisma.maintenanceLog.findMany.mockResolvedValue([
      {
        description: "Quarterly service",
        performedBy: "Vendor A",
        performedAt: new Date("2026-04-01"),
        cost: 200
      }
    ]);

    const result = await service.getHistory("wo-1", { sub: "u1", tenantId: "t1" });

    expect(result.previousBreakdowns).toHaveLength(1);
    expect(result.lastService?.description).toBe("Quarterly service");
    expect(result.repeatIssueWarnings.length).toBeGreaterThan(0);
    expect(result.readOnly).toBe(true);
  });

  it("throws when work order is missing", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(null);
    await expect(service.getHistory("missing", { sub: "u1", tenantId: "t1" })).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
