import { BadRequestException } from "@nestjs/common";
import { RoleName, WorkOrderApprovalStatus, WorkOrderPartLineStatus, WorkOrderStatus } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { compareStockBalances, parseBileetaStockBalances } from "../src/modules/inventory/erp-stock-sync.mapper";
import { boundedPaging, InventoryService } from "../src/modules/inventory/inventory.service";
import { WorkOrderPartsService } from "../src/modules/work-orders/work-order-parts.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

const actor = { sub: "user-1", email: "u@test", role: RoleName.ADMIN, tenantId: "t1" };

describe("work order part lines", () => {
  it("a rejected part request closes its line with zero quantities so it leaves cost and readiness", async () => {
    const prisma = {
      workOrderPart: {
        findFirst: jest.fn().mockResolvedValue({
          id: "line-1",
          lineStatus: WorkOrderPartLineStatus.REQUESTED,
          requestedQuantity: 4,
          approvedQuantity: null,
          reservedQuantity: 2,
          issuedQuantity: 0,
          unitCost: 50
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "line-1", ...data }))
      },
      auditLog: { create: jest.fn() }
    };
    const service = new WorkOrderPartsService(prisma as never);
    await service.syncRejectedLine("pr-1", "Not needed", actor as never);
    expect(prisma.workOrderPart.update).toHaveBeenCalledWith({
      where: { id: "line-1" },
      data: expect.objectContaining({
        lineStatus: WorkOrderPartLineStatus.CLOSED,
        requestedQuantity: 0,
        approvedQuantity: 0,
        reservedQuantity: 0,
        totalCost: 0
      })
    });
  });

  it("releases every reservation on a work order", async () => {
    const prisma = {
      workOrderPart: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn() }
    };
    const service = new WorkOrderPartsService(prisma as never);
    await expect(service.releaseWorkOrderReservations("wo-1", "t1", actor as never)).resolves.toBe(2);
    expect(prisma.workOrderPart.updateMany).toHaveBeenCalledWith({
      where: { workOrderId: "wo-1", tenantId: "t1", reservedQuantity: { gt: 0 } },
      data: { reservedQuantity: 0 }
    });
  });

  it("rejecting a work order releases reservations and sends the converted request back to review", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          tenantId: "t1",
          woNumber: "WO-1",
          approvalStatus: WorkOrderApprovalStatus.PENDING,
          status: WorkOrderStatus.OPEN
        }),
        update: jest.fn().mockResolvedValue({ id: "wo-1", woNumber: "WO-1", status: WorkOrderStatus.CANCELLED }),
        updateMany: jest.fn()
      },
      workOrderLabourEntry: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn() },
      maintenanceRequest: {
        findFirst: jest.fn().mockResolvedValue({ id: "mr-1", requestNumber: "MR-1", reportedById: "reporter", status: "CONVERTED_TO_WO" }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      maintenanceRequestHistory: { create: jest.fn() },
      evidenceAttachment: { updateMany: jest.fn() }
    };
    const parts = createWorkOrderPartsServiceMock();
    const notifications = { createNotification: jest.fn() };
    const service = new WorkOrdersService(
      prisma as never,
      notifications as never,
      parts as never,
      createWorkOrderTaxonomyServiceMock() as never,
      { addAssignee: jest.fn() } as never
    );

    await requestContext.run(
      { actorId: actor.sub, actorEmail: actor.email, actorRole: actor.role, tenantId: "t1", module: null, ipAddress: null, userAgent: null, requestPath: null },
      () => service.rejectWorkOrder("wo-1", "Wrong asset", actor as never)
    );

    expect(parts.releaseWorkOrderReservations).toHaveBeenCalledWith("wo-1", "t1", actor, "Work order rejected");
    expect(prisma.maintenanceRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "UNDER_REVIEW", workOrderId: null }) })
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "reporter", message: expect.stringContaining("Wrong asset") })
    );
  });
});

describe("inventory stock-out", () => {
  function build(tx: Record<string, unknown>) {
    const prisma = {
      sparePart: { findFirst: jest.fn().mockResolvedValue({ id: "part-1", isActive: true, unitCost: 25, erpCode: "BRG-1" }) },
      inventoryStockIssueIdempotency: { findUnique: jest.fn().mockResolvedValue(null) },
      workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo-1", status: "IN_PROGRESS", woNumber: "WO-1" }) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (client: unknown) => unknown) => fn(tx))
    };
    const workOrderParts = { recordDirectIssueLine: jest.fn().mockResolvedValue({ id: "line-1" }) };
    const service = new InventoryService(prisma as never, {} as never, {} as never, undefined, workOrderParts as never);
    return { service, workOrderParts };
  }

  it("records an unverified part as a pending ERP consumption and still adds the job part line", async () => {
    const tx = {
      warehouse: { findMany: jest.fn().mockResolvedValue([]) },
      domainEventOutbox: { create: jest.fn().mockResolvedValue({ id: "ob-1" }) },
      inventoryStockIssueIdempotency: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const { service, workOrderParts } = build(tx);
    await service.stockOut("part-1", 2, { workOrderId: "wo-1", idempotencyKey: "k1" }, actor as never).catch(() => undefined);
    expect(tx.domainEventOutbox.create).toHaveBeenCalled();
    expect(workOrderParts.recordDirectIssueLine).toHaveBeenCalledWith(
      expect.objectContaining({ workOrderId: "wo-1", partId: "part-1", quantity: 2 }),
      tx
    );
  });

  it("refuses to issue more than the verified ERP stock", async () => {
    const tx = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: "wh-1", erpWarehouseCode: "MAIN", lastErpValidatedAt: new Date("2026-01-01") }])
      },
      warehouseItemBalance: { findFirst: jest.fn().mockResolvedValue({ id: "b1", onHand: 1, reserved: 0, available: 1 }) },
      domainEventOutbox: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() }
    };
    const { service, workOrderParts } = build(tx);
    await expect(
      service.stockOut("part-1", 2, { workOrderId: "wo-1", idempotencyKey: "k2" }, actor as never)
    ).rejects.toThrow(/Insufficient verified stock/);
    expect(tx.domainEventOutbox.create).not.toHaveBeenCalled();
    expect(workOrderParts.recordDirectIssueLine).not.toHaveBeenCalled();
  });

  it("records the issue on the work order's part lines so the cost reaches the job", async () => {
    const tx = {
      warehouse: {
        findMany: jest.fn().mockResolvedValue([{ id: "wh-1", erpWarehouseCode: "MAIN", lastErpValidatedAt: new Date("2026-01-01") }])
      },
      warehouseItemBalance: { findFirst: jest.fn().mockResolvedValue({ id: "b1", onHand: 10, reserved: 0, available: 10 }) },
      domainEventOutbox: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: "ob-1" }) },
      inventoryStockIssueIdempotency: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const { service, workOrderParts } = build(tx);
    await service.stockOut("part-1", 2, { workOrderId: "wo-1", idempotencyKey: "k1" }, actor as never);
    expect(workOrderParts.recordDirectIssueLine).toHaveBeenCalledWith(
      expect.objectContaining({ workOrderId: "wo-1", partId: "part-1", quantity: 2, unitCost: 25, tenantId: "t1" }),
      tx
    );
  });

  it("bounds list paging to 200 rows", () => {
    expect(boundedPaging({})).toEqual({ take: 2000, skip: 0 });
    expect(boundedPaging({ take: 5000, skip: 400 })).toEqual({ take: 200, skip: 400 });
    expect(boundedPaging({ take: 25, skip: -3 })).toEqual({ take: 25, skip: 0 });
  });

  it("parts list returns data with meta.total", async () => {
    const prisma = {
      sparePart: { count: jest.fn().mockResolvedValue(450), findMany: jest.fn().mockResolvedValue([{ id: "p1" }]) }
    };
    const service = new InventoryService(prisma as never, {} as never, {} as never);
    const result = await service.parts(actor as never, { take: 50, skip: 100 });
    expect(prisma.sparePart.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50, skip: 100 }));
    expect(result.meta).toMatchObject({ total: 450, take: 50, skip: 100, page: 3, totalPages: 9 });
  });
});

describe("ERP stock matching", () => {
  it("matches on erpCode before partNumber", () => {
    const result = compareStockBalances({
      erpBalances: [{ partSku: "ERP-77", quantityOnHand: 9 }],
      maintainProParts: [{ id: "p1", partNumber: "LOCAL-1", erpCode: "erp-77", name: "Bearing", quantityInStock: 5 }]
    });
    expect(result.matchedRows).toEqual([expect.objectContaining({ partId: "p1", erpQuantity: 9, delta: 4 })]);
  });

  it("falls back to partNumber when the erpCode is not in the snapshot", () => {
    const result = compareStockBalances({
      erpBalances: [{ partSku: "LOCAL-1", quantityOnHand: 3 }],
      maintainProParts: [{ id: "p1", partNumber: "LOCAL-1", erpCode: "OTHER", name: "Bearing", quantityInStock: 3 }]
    });
    expect(result.summary.matchedItems).toBe(1);
  });

  it("sums rows for the same item and warehouse instead of overwriting", () => {
    const result = compareStockBalances({
      erpBalances: [
        { partSku: "BRG-1", quantityOnHand: 4, warehouseCode: "MAIN" },
        { partSku: "brg-1", quantityOnHand: 6, warehouseCode: "MAIN" }
      ],
      maintainProParts: [{ id: "p1", partNumber: "BRG-1", name: "Bearing", quantityInStock: 10, warehouseCode: "MAIN" }]
    });
    expect(result.matchedRows[0]).toMatchObject({ erpQuantity: 10, delta: 0 });
  });

  it("rejects rows with a blank quantity instead of reading them as zero", () => {
    expect(() =>
      parseBileetaStockBalances([
        { itemCode: "BRG-1", quantityOnHand: 3 },
        { itemCode: "FLT-2", quantityOnHand: null },
        { itemCode: "FLT-3", qty: "  " }
      ])
    ).toThrow(/without a quantity.*FLT-2, FLT-3/);
    expect(parseBileetaStockBalances([{ itemCode: "BRG-1", quantityOnHand: 0 }])).toEqual([
      { partSku: "BRG-1", quantityOnHand: 0, warehouseCode: undefined }
    ]);
  });
});
