import "reflect-metadata";

import { INestApplication, Module } from "@nestjs/common";
import { APP_GUARD, NestFactory, Reflector } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";

import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../src/common/guards/permissions.guard";
import { PrismaService } from "../src/database/prisma.service";
import { InventoryController } from "../src/modules/inventory/inventory.controller";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { WorkOrdersController } from "../src/modules/work-orders/work-orders.controller";
import { WorkOrderActivityService } from "../src/modules/work-orders/work-order-activity.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";

const inventoryService = {
  parts: jest.fn(),
  createPart: jest.fn(),
  bulkDeleteParts: jest.fn(),
  bulkUpdateCategory: jest.fn(),
  part: jest.fn(),
  updatePart: jest.fn(),
  removePart: jest.fn(),
  stockIn: jest.fn(),
  stockOut: jest.fn(),
  movements: jest.fn(),
  linkedWorkOrders: jest.fn(),
  purchaseHistoryForPart: jest.fn(),
  usageTrend: jest.fn(),
  topUsedParts: jest.fn(),
  lowStock: jest.fn(),
  purchaseOrders: jest.fn(),
  getPurchaseOrder: jest.fn(),
  createPurchaseOrder: jest.fn(),
  updatePurchaseOrder: jest.fn(),
  approvePurchaseOrderOperational: jest.fn(),
  approvePurchaseOrderFinance: jest.fn(),
  rejectPurchaseOrder: jest.fn(),
  syncPurchaseOrderToErp: jest.fn(),
  retryPurchaseOrderErpSync: jest.fn(),
  suppliers: jest.fn(),
  supplier: jest.fn(),
  createSupplier: jest.fn(),
  updateSupplier: jest.fn(),
  removeSupplier: jest.fn()
};

const workOrdersService = {
  findAll: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  assign: jest.fn(),
  updateStatus: jest.fn(),
  addPart: jest.fn(),
  parts: jest.fn(),
  addNote: jest.fn(),
  addAttachment: jest.fn(),
  listPartRequests: jest.fn(),
  createPartRequest: jest.fn(),
  approvePartRequestOperational: jest.fn(),
  approvePartRequestFinance: jest.fn(),
  rejectPartRequest: jest.fn(),
  issuePartRequest: jest.fn()
};

const workOrderActivityService = {
  getActivityTimeline: jest.fn()
};

const prisma = {
  user: { findUnique: jest.fn() }
};

@Module({
  controllers: [InventoryController, WorkOrdersController],
  providers: [
    Reflector,
    { provide: InventoryService, useValue: inventoryService },
    { provide: WorkOrdersService, useValue: workOrdersService },
    { provide: WorkOrderActivityService, useValue: workOrderActivityService },
    { provide: PrismaService, useValue: prisma },
    { provide: APP_GUARD, useClass: PermissionsGuard }
  ]
})
class Phase3HttpE2eModule {}

describe("Phase 3 workflow HTTP e2e", () => {
  let app: INestApplication;

  beforeAll(async () => {
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, InventoryController);
    Reflect.defineMetadata(IS_PUBLIC_KEY, true, WorkOrdersController);

    app = await NestFactory.create(Phase3HttpE2eModule, { logger: false });

    app.use((req: Request & { user?: unknown }, _res: Response, next: NextFunction) => {
      const permissionsHeader = req.headers["x-test-permissions"];
      const permissions =
        typeof permissionsHeader === "string" && permissionsHeader.trim().length > 0
          ? permissionsHeader.split(",").map((v) => v.trim()).filter(Boolean)
          : [];

      req.user = {
        sub: req.headers["x-test-user-id"] ?? "user-actor",
        email: req.headers["x-test-email"] ?? "actor@example.com",
        role: req.headers["x-test-role"] ?? "ADMIN",
        tenantId: req.headers["x-tenant-id"] ?? "tenant-1",
        permissions
      };

      next();
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Part Requests ───

  describe("Part Requests", () => {
    it("creates a part request when permission is granted", async () => {
      workOrdersService.createPartRequest.mockResolvedValueOnce({
        id: "pr-1",
        workOrderId: "wo-1",
        partId: "part-1",
        quantity: 2,
        status: "PENDING_OPERATIONAL"
      });

      const res = await request(app.getHttpServer())
        .post("/work-orders/wo-1/part-requests")
        .set("x-test-permissions", "part_requests.create")
        .send({ partId: "part-1", quantity: 2, reason: "needed" })
        .expect(201);

      expect(res.body.message).toBe("Part request submitted");
      expect(res.body.data).toEqual(expect.objectContaining({ id: "pr-1", status: "PENDING_OPERATIONAL" }));
      expect(workOrdersService.createPartRequest).toHaveBeenCalledWith(
        "wo-1",
        expect.objectContaining({ partId: "part-1", quantity: 2, reason: "needed" }),
        expect.objectContaining({ permissions: ["part_requests.create"] })
      );
    });

    it("returns 403 when creating a part request without permission", async () => {
      await request(app.getHttpServer())
        .post("/work-orders/wo-1/part-requests")
        .set("x-test-permissions", "unrelated.permission")
        .send({ partId: "part-1", quantity: 1 })
        .expect(403);

      expect(workOrdersService.createPartRequest).not.toHaveBeenCalled();
    });

    it("approves a part request operationally", async () => {
      workOrdersService.approvePartRequestOperational.mockResolvedValueOnce({
        id: "pr-1",
        status: "PENDING_FINANCE"
      });

      const res = await request(app.getHttpServer())
        .patch("/work-orders/wo-1/part-requests/pr-1/approve-operational")
        .set("x-test-permissions", "part_requests.approve_operational")
        .send({ reason: "ok" })
        .expect(200);

      expect(res.body.message).toBe("Part request operationally approved");
      expect(res.body.data.status).toBe("PENDING_FINANCE");
      expect(workOrdersService.approvePartRequestOperational).toHaveBeenCalledWith(
        "wo-1",
        "pr-1",
        expect.objectContaining({ reason: "ok" }),
        expect.any(Object)
      );
    });

    it("approves a part request at finance stage", async () => {
      workOrdersService.approvePartRequestFinance.mockResolvedValueOnce({
        id: "pr-1",
        status: "APPROVED"
      });

      const res = await request(app.getHttpServer())
        .patch("/work-orders/wo-1/part-requests/pr-1/approve-finance")
        .set("x-test-permissions", "part_requests.approve_finance")
        .send({})
        .expect(200);

      expect(res.body.data.status).toBe("APPROVED");
    });

    it("rejects a part request with required reason", async () => {
      workOrdersService.rejectPartRequest.mockResolvedValueOnce({
        id: "pr-1",
        status: "REJECTED"
      });

      const res = await request(app.getHttpServer())
        .patch("/work-orders/wo-1/part-requests/pr-1/reject")
        .set("x-test-permissions", "part_requests.reject")
        .send({ reason: "out of budget" })
        .expect(200);

      expect(res.body.message).toBe("Part request rejected");
      expect(workOrdersService.rejectPartRequest).toHaveBeenCalledWith(
        "wo-1",
        "pr-1",
        expect.objectContaining({ reason: "out of budget" }),
        expect.any(Object)
      );
    });

    it("issues a part request when stock available", async () => {
      workOrdersService.issuePartRequest.mockResolvedValueOnce({
        id: "pr-1",
        status: "ISSUED"
      });

      const res = await request(app.getHttpServer())
        .post("/work-orders/wo-1/part-requests/pr-1/issue")
        .set("x-test-permissions", "part_requests.issue,inventory.stock_issue")
        .send({})
        .expect(201);

      expect(res.body.data.status).toBe("ISSUED");
    });

    it("propagates out-of-stock failure from service as 400", async () => {
      const { BadRequestException } = await import("@nestjs/common");
      workOrdersService.issuePartRequest.mockRejectedValueOnce(
        new BadRequestException("Insufficient stock to issue")
      );

      const res = await request(app.getHttpServer())
        .post("/work-orders/wo-1/part-requests/pr-1/issue")
        .set("x-test-permissions", "part_requests.issue,inventory.stock_issue")
        .send({})
        .expect(400);

      expect(res.body.message).toBe("Insufficient stock to issue");
    });

    it("returns 403 when issuing without both required permissions", async () => {
      await request(app.getHttpServer())
        .post("/work-orders/wo-1/part-requests/pr-1/issue")
        .set("x-test-permissions", "part_requests.issue") // missing inventory.stock_issue
        .send({})
        .expect(403);

      expect(workOrdersService.issuePartRequest).not.toHaveBeenCalled();
    });
  });

  // ─── Purchase Orders ───

  describe("Purchase Order workflow", () => {
    it("approves a PO operationally", async () => {
      inventoryService.approvePurchaseOrderOperational.mockResolvedValueOnce({
        id: "po-1",
        workflowStatus: "PENDING_FINANCE"
      });

      const res = await request(app.getHttpServer())
        .patch("/inventory/purchase-orders/po-1/approve-operational")
        .set("x-test-permissions", "purchase_orders.approve_operational")
        .send({ reason: "approved" })
        .expect(200);

      expect(res.body.message).toBe("Purchase order operationally approved");
      expect(res.body.data.workflowStatus).toBe("PENDING_FINANCE");
    });

    it("approves a PO at finance stage", async () => {
      inventoryService.approvePurchaseOrderFinance.mockResolvedValueOnce({
        id: "po-1",
        workflowStatus: "APPROVED"
      });

      const res = await request(app.getHttpServer())
        .patch("/inventory/purchase-orders/po-1/approve-finance")
        .set("x-test-permissions", "purchase_orders.approve_finance")
        .send({})
        .expect(200);

      expect(res.body.data.workflowStatus).toBe("APPROVED");
    });

    it("rejects a PO with required reason", async () => {
      inventoryService.rejectPurchaseOrder.mockResolvedValueOnce({
        id: "po-1",
        workflowStatus: "REJECTED"
      });

      const res = await request(app.getHttpServer())
        .patch("/inventory/purchase-orders/po-1/reject")
        .set("x-test-permissions", "purchase_orders.reject")
        .send({ reason: "duplicate" })
        .expect(200);

      expect(res.body.message).toBe("Purchase order rejected");
      expect(inventoryService.rejectPurchaseOrder).toHaveBeenCalledWith(
        "po-1",
        expect.objectContaining({ reason: "duplicate" }),
        expect.any(Object)
      );
    });

    it("returns 403 when finance approval is attempted without permission", async () => {
      await request(app.getHttpServer())
        .patch("/inventory/purchase-orders/po-1/approve-finance")
        .set("x-test-permissions", "unrelated.permission")
        .send({})
        .expect(403);

      expect(inventoryService.approvePurchaseOrderFinance).not.toHaveBeenCalled();
    });

    it("security officer cannot approve purchase orders", async () => {
      await request(app.getHttpServer())
        .patch("/inventory/purchase-orders/po-1/approve-finance")
        .set("x-test-role", "SECURITY_OFFICER")
        .set("x-test-permissions", "dashboard.view,vehicles.view,gate.out.create,gate.in.create,operations.scan_lookup")
        .send({ reason: "not allowed" })
        .expect(403);

      expect(inventoryService.approvePurchaseOrderFinance).not.toHaveBeenCalled();
    });

    it("executes ERP sync manually", async () => {
      inventoryService.syncPurchaseOrderToErp.mockResolvedValueOnce({
        id: "erp-1",
        status: "SUCCESS",
        attemptNumber: 1
      });

      const res = await request(app.getHttpServer())
        .post("/inventory/purchase-orders/po-1/erp-sync")
        .set("x-test-permissions", "purchase_orders.erp_sync")
        .send({})
        .expect(201);

      expect(res.body.message).toBe("Manual ERP sync executed");
      expect(res.body.data.status).toBe("SUCCESS");
    });

    it("retries failed ERP sync", async () => {
      inventoryService.retryPurchaseOrderErpSync.mockResolvedValueOnce({
        id: "erp-2",
        status: "SUCCESS",
        attemptNumber: 2
      });

      const res = await request(app.getHttpServer())
        .post("/inventory/purchase-orders/po-1/erp-sync/retry")
        .set("x-test-permissions", "purchase_orders.erp_sync_retry")
        .send({})
        .expect(201);

      expect(res.body.message).toBe("ERP sync retry executed");
      expect(res.body.data.attemptNumber).toBe(2);
    });

    it("returns 403 when ERP sync retry is attempted without permission", async () => {
      await request(app.getHttpServer())
        .post("/inventory/purchase-orders/po-1/erp-sync/retry")
        .set("x-test-permissions", "unrelated.permission")
        .send({})
        .expect(403);

      expect(inventoryService.retryPurchaseOrderErpSync).not.toHaveBeenCalled();
    });
  });
});
