import {
  computeWorkOrderTotalCost,
  contractExpiryStatus,
  erpSyncOutcome,
  resolveStockSourceBoundary
} from "../src/modules/maintenance-supply/supply-boundary";
import { MaintenanceSupplyService } from "../src/modules/maintenance-supply/maintenance-supply.service";
import { SparePartClassification, WorkOrderExecutionMode } from "@prisma/client";

describe("Phase 9 supply boundary", () => {
  it("keeps official stock at Bileeta / never treats MaintainPro as purchase truth", () => {
    const boundary = resolveStockSourceBoundary({
      erpCode: "ERP-100",
      erpSyncEnabled: true,
      productionMode: true
    });
    expect(boundary.source).toBe("BILEETA_ERP");
    expect(boundary.authoritative).toBe(false);
    expect(boundary.mayPurchase).toBe(false);
    expect(boundary.mayReserve).toBe(true);
  });

  it("never reports mock sync as production success", () => {
    const mockOk = erpSyncOutcome({
      productionMode: true,
      mockMode: true,
      success: true
    });
    expect(mockOk.reportableAsProductionSuccess).toBe(false);
    expect(mockOk.status).toBe("MOCK_OK");

    const fail = erpSyncOutcome({
      productionMode: true,
      mockMode: false,
      success: false,
      error: "timeout"
    });
    expect(fail.ok).toBe(false);
    expect(fail.reportableAsProductionSuccess).toBe(false);
  });

  it("snapshots unit costs into stable WO total", () => {
    const total = computeWorkOrderTotalCost({
      partsCost: 100,
      internalLabourCost: 50,
      externalServiceCost: 200,
      transportCost: 25,
      otherCost: 25
    });
    expect(total).toBe(400);
  });

  it("flags contract expiry", () => {
    const now = new Date("2026-09-14T00:00:00.000Z");
    expect(
      contractExpiryStatus({
        endDate: new Date("2026-12-01T00:00:00.000Z"),
        now,
        reminderDays: 30
      })
    ).toBe("ACTIVE");
    expect(
      contractExpiryStatus({
        endDate: new Date("2026-09-20T00:00:00.000Z"),
        now,
        reminderDays: 30
      })
    ).toBe("EXPIRING");
    expect(
      contractExpiryStatus({
        endDate: new Date("2026-09-01T00:00:00.000Z"),
        now
      })
    ).toBe("EXPIRED");
  });
});

describe("Phase 9 MaintenanceSupplyService", () => {
  const actor = { sub: "user-1", tenantId: "tenant-1" };

  it("creates immutable cost snapshot and ignores second write", async () => {
    const existing = {
      id: "snap-1",
      workOrderId: "wo-1",
      totalCost: 400,
      partsCost: 100
    };
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "wo-1", tenantId: "tenant-1" }),
        update: jest.fn()
      },
      workOrderCostSnapshot: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existing),
        create: jest.fn().mockResolvedValue(existing)
      }
    };
    const service = new MaintenanceSupplyService(prisma as any);
    const first = await service.snapshotWorkOrderCosts(actor, "wo-1", {
      partsCost: 100,
      internalLabourCost: 50,
      externalServiceCost: 200,
      transportCost: 25,
      otherCost: 25
    });
    expect(first.totalCost).toBe(400);
    expect(prisma.workOrderCostSnapshot.create).toHaveBeenCalledTimes(1);

    const second = await service.snapshotWorkOrderCosts(actor, "wo-1", {
      partsCost: 999,
      internalLabourCost: 0,
      externalServiceCost: 0,
      transportCost: 0,
      otherCost: 0
    });
    expect(second.totalCost).toBe(400);
    expect(prisma.workOrderCostSnapshot.create).toHaveBeenCalledTimes(1);
  });

  it("supports tool issue return", async () => {
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-1",
          tenantId: "tenant-1",
          quantity: 2,
          quantityReturned: 0,
          expectsReturn: true,
          returnedAt: null,
          part: { classification: SparePartClassification.TOOL }
        }),
        update: jest.fn().mockResolvedValue({
          id: "issue-1",
          quantityReturned: 2,
          returnedAt: new Date()
        })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any);
    const row = await service.returnToolIssue(actor, "issue-1", { quantityReturned: 2 });
    expect(row.quantityReturned).toBe(2);
  });

  it("assigns vendor and sets EXTERNAL execution mode", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "wo-1", notes: null }),
        update: jest.fn().mockResolvedValue({
          id: "wo-1",
          executionMode: WorkOrderExecutionMode.EXTERNAL
        })
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({
          id: "sup-1",
          name: "CoolTech",
          isActive: true
        })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any);
    const wo = await service.assignVendorToWorkOrder(actor, "wo-1", "sup-1");
    expect(wo.executionMode).toBe(WorkOrderExecutionMode.EXTERNAL);
    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ executionMode: WorkOrderExecutionMode.EXTERNAL })
      })
    );
  });

  it("creates AMC contract with expiry status", async () => {
    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: "sup-1", tenantId: "tenant-1" })
      },
      vendorContract: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "c1", ...data }))
      }
    };
    const service = new MaintenanceSupplyService(prisma as any);
    const contract = await service.createVendorContract(actor, {
      supplierId: "sup-1",
      contractNo: "AMC-2026-01",
      title: "HVAC AMC",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-09-20"),
      reminderDays: 30
    });
    expect(contract.status).toBe("EXPIRING");
    expect(contract.contractType).toBe("AMC");
  });
});
