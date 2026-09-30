import { ConflictException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  STOCK_QUANTITY_OWNER,
  WORK_ORDER_PART_CONSUMPTION_EVENT,
  buildWorkOrderPartConsumptionOutbox,
  describeErpSyncStatus,
  workOrderIssueMutatesMirroredStock
} from "../src/modules/work-orders/work-order-erp-consumption";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

describe("ERP stock ownership boundary", () => {
  it("keeps SparePart quantity owned by Bileeta", () => {
    expect(STOCK_QUANTITY_OWNER).toBe("BILEETA");
    expect(workOrderIssueMutatesMirroredStock()).toBe(false);
  });

  it("records work-order consumption as a pending ERP event with cost", () => {
    const row = buildWorkOrderPartConsumptionOutbox({
      tenantId: "tenant-a",
      issueId: "issue-1",
      workOrderId: "wo-1",
      partRequestId: "req-1",
      partId: "part-1",
      erpCode: "ERP-100",
      quantity: 2,
      unitCost: 15
    });

    expect(row.tenantId).toBe("tenant-a");
    expect(row.eventType).toBe(WORK_ORDER_PART_CONSUMPTION_EVENT);
    expect(row.status).toBe("PENDING");
    expect(JSON.parse(row.payload)).toMatchObject({
      owner: "BILEETA",
      quantityInStockMutated: false,
      erpCode: "ERP-100",
      quantity: 2,
      unitCost: 15,
      lineCost: 30
    });
  });

  it("keeps pending and failed ERP sync visible and not successful", () => {
    expect(describeErpSyncStatus("PENDING")).toEqual({
      status: "PENDING",
      visible: true,
      treatedAsSuccess: false
    });
    expect(describeErpSyncStatus("FAILED").treatedAsSuccess).toBe(false);
    expect(describeErpSyncStatus("FAILED").visible).toBe(true);
    expect(describeErpSyncStatus("PROCESSED").treatedAsSuccess).toBe(true);
  });
});

describe("issuePartRequest ERP boundary", () => {
  const keeper = {
    sub: "keeper-1",
    email: "keeper@example.com",
    role: RoleName.INVENTORY_KEEPER,
    tenantId: "tenant-a"
  };

  function approvedRequest(overrides: Record<string, unknown> = {}) {
    return {
      id: "req-1",
      tenantId: "tenant-a",
      workOrderId: "wo-1",
      partId: "part-1",
      requestedById: "tech-1",
      status: "APPROVED",
      requestedQuantity: 2,
      approvedQuantity: 2,
      issuedQuantity: 0,
      unitCostSnapshot: 15,
      part: { erpCode: "ERP-100", unitCost: 15, quantityInStock: 40, availableQuantity: 40, reservedQuantity: 0 },
      workOrder: { id: "wo-1", vehicleId: null },
      ...overrides
    };
  }

  function buildService(request = approvedRequest(), fresh = request) {
    const sparePartUpdate = jest.fn();
    const tx = {
      partRequest: {
        findFirst: jest.fn().mockResolvedValue(fresh),
        update: jest.fn().mockResolvedValue({})
      },
      workOrderPart: { update: jest.fn().mockResolvedValue({}) },
      partIssue: {
        create: jest.fn().mockResolvedValue({ id: "issue-1" }),
        update: jest.fn().mockResolvedValue({})
      },
      domainEventOutbox: { create: jest.fn().mockResolvedValue({ id: "outbox-1" }) },
      sparePart: { update: sparePartUpdate }
    };
    const prisma = {
      workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo-1", tenantId: "tenant-a" }) },
      partRequest: { findFirst: jest.fn().mockResolvedValue(request) },
      workOrderPart: { findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
      sparePart: { update: sparePartUpdate },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx))
    };
    const parts = createWorkOrderPartsServiceMock();
    const service = new WorkOrdersService(
      prisma as never,
      { createNotification: jest.fn().mockResolvedValue({}) } as never,
      parts as never,
      createWorkOrderTaxonomyServiceMock() as never,
      { addAssignee: jest.fn() } as never
    );
    return { service, prisma, parts, tx, sparePartUpdate };
  }

  it("records consumption and cost without mutating the mirrored quantity", async () => {
    const { service, prisma, parts, tx, sparePartUpdate } = buildService();

    await service.issuePartRequest("wo-1", "req-1", { quantity: 2 }, keeper);

    expect(prisma.partRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-a", workOrderId: "wo-1" }) })
    );
    expect(tx.partIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 2, unitCostSnapshot: 15, tenantId: "tenant-a" })
      })
    );
    expect(tx.domainEventOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", tenantId: "tenant-a" })
      })
    );
    expect(parts.syncIssuedLine).toHaveBeenCalledWith(expect.objectContaining({ issueQuantity: 2 }));
    expect(sparePartUpdate).not.toHaveBeenCalled();
    const audit = prisma.auditLog.create.mock.calls[0][0].data.metadata;
    expect(audit.quantityInStockMutated).toBe(false);
    expect(audit.erpReconciliationStatus).toBe("PENDING");
  });

  it("rejects an unauthorized issuer", async () => {
    const { service, parts } = buildService();
    parts.assertStorekeeperCanIssue.mockImplementation(() => {
      throw new ForbiddenException("Only inventory keepers or managers can issue stock.");
    });

    await expect(
      service.issuePartRequest("wo-1", "req-1", { quantity: 1 }, {
        sub: "tech-1",
        email: "tech@example.com",
        role: RoleName.TECHNICIAN,
        tenantId: "tenant-a"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an invalid quantity", async () => {
    const { service } = buildService();
    await expect(service.issuePartRequest("wo-1", "req-1", { quantity: 0 }, keeper)).rejects.toThrow(
      "Issue quantity must be greater than 0"
    );
  });

  it("rejects a duplicate issue once the approved quantity is already issued", async () => {
    const { service } = buildService(approvedRequest(), approvedRequest({ issuedQuantity: 2 }));
    await expect(service.issuePartRequest("wo-1", "req-1", { quantity: 1 }, keeper)).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
