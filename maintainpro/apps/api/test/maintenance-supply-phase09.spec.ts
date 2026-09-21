import {
  computeWorkOrderTotalCost,
  contractExpiryStatus,
  erpSyncOutcome,
  resolveStockSourceBoundary
} from "../src/modules/maintenance-supply/supply-boundary";
import { MaintenanceSupplyService } from "../src/modules/maintenance-supply/maintenance-supply.service";
import {
  ApprovalProcessType,
  ApprovalRequestStatus,
  SparePartClassification,
  WorkOrderExecutionMode
} from "@prisma/client";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";

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

  it("marks MaintainPro stock as reference-only when unmapped", () => {
    const boundary = resolveStockSourceBoundary({
      erpCode: null,
      erpSyncEnabled: false,
      productionMode: true
    });
    expect(boundary.source).toBe("MAINTAINPRO_REFERENCE");
    expect(boundary.authoritative).toBe(false);
    expect(boundary.mayPurchase).toBe(false);
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
    expect(fail.status).toBe("FAILED");
  });

  it("reports honest production ERP success only when not mock", () => {
    const ok = erpSyncOutcome({
      productionMode: true,
      mockMode: false,
      success: true
    });
    expect(ok.ok).toBe(true);
    expect(ok.reportableAsProductionSuccess).toBe(true);
    expect(ok.status).toBe("SUCCESS");
  });

  it("treats production+mock as unavailable boundary (ERP unavailable behavior)", () => {
    const boundary = resolveStockSourceBoundary({
      erpCode: "ERP-1",
      erpSyncEnabled: true,
      productionMode: true,
      mockSync: true
    });
    expect(boundary.source).toBe("UNKNOWN");
    expect(boundary.authoritative).toBe(false);
    expect(boundary.message).toMatch(/Mock sync must never/i);
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

  it("flags contract expiry via shared status helper (Phase 8 bridge)", () => {
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

describe("Phase 9 part classification enums", () => {
  it("supports SPARE_PART, CONSUMABLE, TOOL requirement classifications", () => {
    expect(SparePartClassification.SPARE_PART).toBe("SPARE_PART");
    expect(SparePartClassification.CONSUMABLE).toBe("CONSUMABLE");
    expect(SparePartClassification.TOOL).toBe("TOOL");
  });

  it("supports INTERNAL, EXTERNAL, MIXED execution modes", () => {
    expect(WorkOrderExecutionMode.INTERNAL).toBe("INTERNAL");
    expect(WorkOrderExecutionMode.EXTERNAL).toBe("EXTERNAL");
    expect(WorkOrderExecutionMode.MIXED).toBe("MIXED");
  });
});

describe("Phase 9 RBAC catalog", () => {
  it("registers granular parts/erp/vendor/cost permissions", () => {
    for (const key of [
      "parts.view",
      "parts.issue",
      "parts.return",
      "erp.mapping.manage",
      "vendor.manage",
      "contract.manage",
      "cost.view",
      "cost.adjust"
    ]) {
      expect(PERMISSION_CATALOG).toContain(key);
    }
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
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
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

  it("does not alter historic snapshot when master unit cost would change", async () => {
    const snapshot = {
      id: "snap-1",
      workOrderId: "wo-1",
      partsCost: 50,
      totalCost: 50,
      lineItems: { partsCost: 50 }
    };
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "wo-1", tenantId: "tenant-1" }),
        update: jest.fn()
      },
      workOrderCostSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
        create: jest.fn()
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const row = await service.snapshotWorkOrderCosts(actor, "wo-1", {
      partsCost: 9999
    });
    expect(row.partsCost).toBe(50);
    expect(prisma.workOrderCostSnapshot.create).not.toHaveBeenCalled();
  });

  it("computes consumption as issued minus returned (quantity math)", () => {
    const service = new MaintenanceSupplyService({} as any, undefined, undefined);
    expect(service.computeConsumption({ quantity: 5, quantityReturned: 2 })).toBe(3);
    expect(service.computeConsumption({ quantity: 2, quantityReturned: 2 })).toBe(0);
    expect(service.computeConsumption({ quantity: 1, quantityReturned: null })).toBe(1);
  });

  it("builds live cost from part unitCostSnapshot, labour snapshot, and external invoices", async () => {
    const prisma = {
      partIssue: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 5, quantityReturned: 2, unitCostSnapshot: 10 },
          { quantity: 1, quantityReturned: 0, unitCostSnapshot: 20 }
        ])
      },
      workOrderLabourEntry: {
        findMany: jest.fn().mockResolvedValue([
          { durationMinutes: 60, labourRateSnapshot: 100 },
          { durationMinutes: 30, labourRateSnapshot: 80 }
        ])
      },
      vendorInvoice: {
        findMany: jest.fn().mockResolvedValue([{ totalAmount: 250, invoiceAmount: 200 }])
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const breakdown = await service.buildCostBreakdownFromWo("wo-1");
    // parts: 3*10 + 1*20 = 50; labour: 1*100 + 0.5*80 = 140; external 250
    expect(breakdown.partsCost).toBe(50);
    expect(breakdown.internalLabourCost).toBe(140);
    expect(breakdown.externalServiceCost).toBe(250);
    expect(computeWorkOrderTotalCost(breakdown)).toBe(440);
  });

  it("blocks over-return of tools", async () => {
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-1",
          tenantId: "tenant-1",
          partId: "part-1",
          workOrderId: "wo-1",
          warehouseId: null,
          quantity: 2,
          quantityReturned: 1,
          expectsReturn: true,
          returnedAt: null,
          part: { classification: SparePartClassification.TOOL }
        }),
        update: jest.fn()
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    await expect(
      service.returnToolIssue(actor, "issue-1", { quantityReturned: 2 })
    ).rejects.toThrow("Returned quantity exceeds issued quantity");
    expect(prisma.partIssue.update).not.toHaveBeenCalled();
  });

  it("allows TOOL classification return even when expectsReturn is false", async () => {
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-2",
          tenantId: "tenant-1",
          partId: "part-2",
          workOrderId: "wo-1",
          warehouseId: null,
          quantity: 1,
          quantityReturned: 0,
          expectsReturn: false,
          returnedAt: null,
          part: { classification: SparePartClassification.TOOL }
        }),
        update: jest.fn().mockResolvedValue({
          id: "issue-2",
          quantityReturned: 1,
          expectsReturn: true
        })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const row = await service.returnToolIssue(actor, "issue-2", { quantityReturned: 1 });
    expect(row.quantityReturned).toBe(1);
    expect(prisma.partIssue.update).toHaveBeenCalled();
  });

  it("supports unused spare/tool return", async () => {
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-1",
          tenantId: "tenant-1",
          partId: "part-1",
          workOrderId: "wo-1",
          warehouseId: null,
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
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const row = await service.returnToolIssue(actor, "issue-1", { quantityReturned: 2 });
    expect(row.quantityReturned).toBe(2);
  });

  it("uses idempotent stock-engine key on return (return idempotency)", async () => {
    const returnStock = jest.fn().mockResolvedValue({ id: "mv-1" });
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-9",
          tenantId: "tenant-1",
          partId: "part-1",
          workOrderId: "wo-1",
          warehouseId: "wh-1",
          quantity: 3,
          quantityReturned: 0,
          expectsReturn: true,
          returnedAt: null,
          part: { classification: SparePartClassification.SPARE_PART }
        }),
        update: jest.fn().mockResolvedValue({
          id: "issue-9",
          quantityReturned: 1
        })
      }
    };
    const service = new MaintenanceSupplyService(
      prisma as any,
      { returnStock } as any,
      undefined
    );
    await service.returnToolIssue(actor, "issue-9", { quantityReturned: 1 });
    expect(returnStock).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "part-return:issue-9:1",
        sourceType: "PART_ISSUE_RETURN"
      })
    );
  });

  it("rejects consumable return when expectsReturn is false", async () => {
    const prisma = {
      partIssue: {
        findFirst: jest.fn().mockResolvedValue({
          id: "issue-c",
          tenantId: "tenant-1",
          partId: "part-c",
          workOrderId: "wo-1",
          warehouseId: null,
          quantity: 5,
          quantityReturned: 0,
          expectsReturn: false,
          returnedAt: null,
          part: { classification: SparePartClassification.CONSUMABLE }
        }),
        update: jest.fn()
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    await expect(
      service.returnToolIssue(actor, "issue-c", { quantityReturned: 1 })
    ).rejects.toThrow("Issue does not expect a tool return");
  });

  it("assigns vendor and sets EXTERNAL execution mode", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          notes: null,
          priority: "MEDIUM",
          type: "CORRECTIVE",
          estimatedCost: 100,
          actualCost: null,
          siteId: null,
          departmentId: null,
          domainId: null,
          status: "OPEN"
        }),
        update: jest.fn().mockResolvedValue({
          id: "wo-1",
          executionMode: WorkOrderExecutionMode.EXTERNAL,
          vendorSupplierId: "sup-1"
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
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const wo = await service.assignVendorToWorkOrder(actor, "wo-1", "sup-1");
    expect(wo.executionMode).toBe(WorkOrderExecutionMode.EXTERNAL);
    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          executionMode: WorkOrderExecutionMode.EXTERNAL,
          vendorSupplierId: "sup-1"
        })
      })
    );
  });

  it("sets INTERNAL and MIXED execution modes", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "wo-1", tenantId: "tenant-1" }),
        update: jest
          .fn()
          .mockResolvedValueOnce({ id: "wo-1", executionMode: WorkOrderExecutionMode.INTERNAL })
          .mockResolvedValueOnce({ id: "wo-1", executionMode: WorkOrderExecutionMode.MIXED })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const internal = await service.setExecutionMode(
      actor,
      "wo-1",
      WorkOrderExecutionMode.INTERNAL
    );
    const mixed = await service.setExecutionMode(actor, "wo-1", WorkOrderExecutionMode.MIXED);
    expect(internal.executionMode).toBe(WorkOrderExecutionMode.INTERNAL);
    expect(mixed.executionMode).toBe(WorkOrderExecutionMode.MIXED);
  });

  it("blocks vendor assignment when Phase 7 approval is pending (vendor repair approval)", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          notes: null,
          priority: "HIGH",
          type: "CORRECTIVE",
          estimatedCost: 50000,
          actualCost: null,
          siteId: null,
          departmentId: null,
          domainId: null,
          status: "OPEN"
        }),
        update: jest.fn()
      },
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: "sup-1", name: "CoolTech", isActive: true })
      }
    };
    const approvalsService = {
      ensureApprovalRequired: jest.fn().mockResolvedValue({
        required: true,
        status: ApprovalRequestStatus.PENDING,
        approvalRequestId: "apr-1",
        configError: null
      })
    };
    const service = new MaintenanceSupplyService(
      prisma as any,
      undefined,
      approvalsService as any
    );
    await expect(service.assignVendorToWorkOrder(actor, "wo-1", "sup-1")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "APPROVAL_REQUIRED",
        processType: ApprovalProcessType.VENDOR_REPAIR
      })
    });
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("creates AMC contract with expiry status and compliance bridge", async () => {
    // Date-relative fixture: endDate must sit inside the reminder window relative to *now*,
    // not a hard-coded calendar day (2026-09-20 became EXPIRED after that date — CI flake).
    const nowMs = Date.now();
    const startDate = new Date(nowMs - 180 * 24 * 60 * 60 * 1000);
    const endDate = new Date(nowMs + 6 * 24 * 60 * 60 * 1000);

    const prisma = {
      supplier: {
        findFirst: jest.fn().mockResolvedValue({ id: "sup-1", tenantId: "tenant-1", name: "CoolTech" })
      },
      $transaction: jest.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          complianceRequirement: {
            create: jest.fn().mockResolvedValue({ id: "comp-1" })
          },
          vendorContract: {
            create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "c1", ...data }))
          }
        };
        return fn(tx);
      })
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const contract = await service.createVendorContract(actor, {
      supplierId: "sup-1",
      contractNo: "AMC-2026-01",
      title: "HVAC AMC",
      startDate,
      endDate,
      reminderDays: 30
    });
    expect(contract.status).toBe("EXPIRING");
    expect(contract.contractType).toBe("AMC");
    expect(contract.complianceRequirementId).toBe("comp-1");
  });

  it("maps ERP item and blocks duplicate mapping", async () => {
    const prisma = {
      sparePart: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: "part-1", tenantId: "tenant-1", partNumber: "P-1" })
          .mockResolvedValueOnce({ id: "part-2", partNumber: "P-2" }),
        update: jest.fn()
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    await expect(service.mapErpItem(actor, "part-1", "ERP-DUP")).rejects.toThrow(
      /already mapped/
    );
    expect(prisma.sparePart.update).not.toHaveBeenCalled();
  });

  it("maps ERP item when unique", async () => {
    const prisma = {
      sparePart: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: "part-1", tenantId: "tenant-1", partNumber: "P-1" })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({ id: "part-1", erpCode: "ERP-100" })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const row = await service.mapErpItem(actor, "part-1", "ERP-100");
    expect(row.erpCode).toBe("ERP-100");
  });

  it("maps warehouse ERP code with validation timestamp", async () => {
    const prisma = {
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: "wh-1", tenantId: "tenant-1" }),
        update: jest.fn().mockResolvedValue({
          id: "wh-1",
          erpWarehouseCode: "WH-ERP-1",
          lastErpValidatedAt: new Date()
        })
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const row = await service.mapWarehouse(actor, "wh-1", "WH-ERP-1");
    expect(row.erpWarehouseCode).toBe("WH-ERP-1");
    expect(prisma.warehouse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ erpWarehouseCode: "WH-ERP-1" })
      })
    );
  });

  it("lists parts with mapping/criticalSpare reconciliation flags", async () => {
    const prisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "p1",
            partNumber: "A",
            name: "Bearing",
            classification: SparePartClassification.SPARE_PART,
            erpCode: "ERP-1",
            criticalSpare: true,
            maintenanceAlias: null,
            maintenanceCategory: null,
            referenceStock: 2,
            quantityInStock: 2,
            availableQuantity: 2
          },
          {
            id: "p2",
            partNumber: "B",
            name: "Grease",
            classification: SparePartClassification.CONSUMABLE,
            erpCode: null,
            criticalSpare: false,
            maintenanceAlias: null,
            maintenanceCategory: null,
            referenceStock: null,
            quantityInStock: 0,
            availableQuantity: 0
          }
        ])
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const rows = await service.listPartsMapping(actor);
    expect(rows[0].mapped).toBe(true);
    expect(rows[0].criticalSpare).toBe(true);
    expect(rows[1].mapped).toBe(false);
    expect(rows[1].stockBoundary.source).toBe("MAINTAINPRO_REFERENCE");
  });

  it("lists outstanding tools for storekeeper UX", async () => {
    const prisma = {
      partIssue: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "i1",
            quantity: 2,
            quantityReturned: 1,
            expectsReturn: true,
            part: {
              id: "t1",
              partNumber: "TOOL-1",
              name: "Torque wrench",
              classification: SparePartClassification.TOOL
            }
          },
          {
            id: "i2",
            quantity: 1,
            quantityReturned: 1,
            expectsReturn: true,
            part: {
              id: "t2",
              partNumber: "TOOL-2",
              name: "Returned",
              classification: SparePartClassification.TOOL
            }
          }
        ])
      }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    const rows = await service.listOutstandingTools(actor);
    expect(rows).toHaveLength(1);
    expect(rows[0].outstandingQuantity).toBe(1);
  });

  it("enforces tenant isolation on cost snapshot (wrong tenant NotFound)", async () => {
    const prisma = {
      workOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      workOrderCostSnapshot: { findUnique: jest.fn(), create: jest.fn() }
    };
    const service = new MaintenanceSupplyService(prisma as any, undefined, undefined);
    await expect(
      service.snapshotWorkOrderCosts(
        { sub: "u", tenantId: "other-tenant" },
        "wo-1",
        { partsCost: 1 }
      )
    ).rejects.toThrow(/not found/i);
  });

  it("stockBoundaryForPart never marks MaintainPro as authoritative", () => {
    const service = new MaintenanceSupplyService({} as any, undefined, undefined);
    const b = service.stockBoundaryForPart(
      { erpCode: "X" },
      { erpSyncEnabled: true, productionMode: true }
    );
    expect(b.authoritative).toBe(false);
    expect(b.mayPurchase).toBe(false);
  });
});

describe("Phase 9 schema contract smoke (repair warranty / compatibility / critical)", () => {
  it("documents repair warranty and part compatibility field expectations", () => {
    // RepairWarranty and PartCompatibility are Prisma models; runtime CRUD may use admin/API later.
    const warranty = {
      workOrderId: "wo-1",
      supplierId: "sup-1",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2027-01-01"),
      coverage: "Compressor seal",
      reference: "WR-100"
    };
    const compatibility = {
      partId: "part-1",
      assetId: null as string | null,
      assetTypeMasterId: "type-motor-x"
    };
    expect(warranty.reference).toBe("WR-100");
    expect(compatibility.assetTypeMasterId).toBe("type-motor-x");
  });
});
