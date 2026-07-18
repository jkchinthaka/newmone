import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PartApprovalTier, RoleName, WorkOrderPartLineStatus, WorkOrderStatus } from "@prisma/client";

import {
  assertPositiveQuantity,
  assertQuantityBalance,
  assertWorkOrderAllowsParts,
  deriveLineStatus,
  pendingQuantity,
  requiresFinanceApprovalForTier,
  requiresProcurement,
  resolvePartApprovalTier
} from "../src/common/utils/work-order-parts-governance";
import { WorkOrderPartsService } from "../src/modules/work-orders/work-order-parts.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

describe("work-order-parts-governance (UAT-010)", () => {
  describe("approval tier thresholds", () => {
    it("classifies low, medium, and high cost tiers", () => {
      expect(resolvePartApprovalTier(5000)).toBe(PartApprovalTier.LOW);
      expect(resolvePartApprovalTier(15000)).toBe(PartApprovalTier.MEDIUM);
      expect(resolvePartApprovalTier(60000)).toBe(PartApprovalTier.HIGH);
    });

    it("requires finance approval for high tier and medium petty cash", () => {
      expect(requiresFinanceApprovalForTier(PartApprovalTier.HIGH)).toBe(true);
      expect(requiresFinanceApprovalForTier(PartApprovalTier.MEDIUM, true)).toBe(true);
      expect(requiresFinanceApprovalForTier(PartApprovalTier.MEDIUM, false)).toBe(false);
      expect(requiresFinanceApprovalForTier(PartApprovalTier.LOW)).toBe(false);
    });

    it("flags procurement when stock is insufficient", () => {
      expect(requiresProcurement(2, 5)).toBe(true);
      expect(requiresProcurement(10, 5)).toBe(false);
    });
  });

  describe("quantity validation", () => {
    it("blocks non-positive quantities", () => {
      expect(() => assertPositiveQuantity("Qty", 0)).toThrow(BadRequestException);
    });

    it("calculates pending quantity from issued usage and returns", () => {
      expect(
        pendingQuantity({
          requestedQuantity: 5,
          issuedQuantity: 5,
          usedQuantity: 3,
          returnedQuantity: 1,
          damagedQuantity: 0,
          pendingReturnQuantity: 0
        })
      ).toBe(1);
    });

    it("derives CLOSED when issued parts are fully accounted", () => {
      expect(
        deriveLineStatus({
          requestedQuantity: 5,
          approvedQuantity: 5,
          issuedQuantity: 5,
          usedQuantity: 3,
          returnedQuantity: 2,
          damagedQuantity: 0,
          pendingReturnQuantity: 0
        })
      ).toBe(WorkOrderPartLineStatus.CLOSED);
    });

    it("rejects quantity balance overflow", () => {
      expect(() =>
        assertQuantityBalance({
          requestedQuantity: 5,
          issuedQuantity: 5,
          usedQuantity: 4,
          returnedQuantity: 2,
          damagedQuantity: 0,
          pendingReturnQuantity: 0
        })
      ).toThrow(BadRequestException);
    });

    it("blocks parts on closed work orders without override", () => {
      expect(() => assertWorkOrderAllowsParts(WorkOrderStatus.COMPLETED)).toThrow(BadRequestException);
      expect(() => assertWorkOrderAllowsParts(WorkOrderStatus.COMPLETED, "Emergency override")).not.toThrow();
    });
  });

  describe("WorkOrderPartsService", () => {
    const prisma = {
      workOrderPart: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      workOrder: { findFirst: jest.fn() },
      sparePart: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({
          sparePart: { update: jest.fn() },
          stockMovement: { create: jest.fn() },
          workOrderPart: {
            update: jest.fn().mockResolvedValue({
              id: "line-1",
              returnedQuantity: 2,
              pendingReturnQuantity: 0,
              lineStatus: WorkOrderPartLineStatus.RETURNED
            })
          }
        })
      )
    };

    const service = new WorkOrderPartsService(prisma as any);

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("blocks technicians from issuing stock", () => {
      expect(() => service.assertStorekeeperCanIssue(RoleName.TECHNICIAN)).toThrow(ForbiddenException);
      expect(() => service.assertStorekeeperCanIssue(RoleName.INVENTORY_KEEPER)).not.toThrow();
    });

    it("blocks mark used when nothing issued", async () => {
      prisma.workOrder.findFirst.mockResolvedValue({ id: "wo-1", status: WorkOrderStatus.IN_PROGRESS });
      prisma.workOrderPart.findFirst.mockResolvedValue({
        id: "line-1",
        workOrderId: "wo-1",
        issuedQuantity: 0,
        usedQuantity: 0,
        returnedQuantity: 0,
        damagedQuantity: 0,
        pendingReturnQuantity: 0,
        requestedQuantity: 2
      });

      await expect(
        service.markUsed("wo-1", "line-1", { usedQuantity: 1 }, { sub: "t1", role: RoleName.TECHNICIAN, email: "t@x.com", tenantId: "tenant-1" })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("WorkOrdersService parts RBAC", () => {
    it("blocks technicians from direct stock issue", async () => {
      const partsMock = createWorkOrderPartsServiceMock();
      partsMock.assertStorekeeperCanIssue.mockImplementation(() => {
        throw new ForbiddenException("Only inventory keepers or managers can issue stock.");
      });

      const prisma = {
        workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo-1", status: WorkOrderStatus.IN_PROGRESS }) }
      };

      const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, partsMock as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

      await expect(
        service.addPart("wo-1", { partId: "p1", quantity: 1, unitCost: 10 }, {
          sub: "tech-1",
          email: "tech@x.com",
          role: RoleName.TECHNICIAN,
          tenantId: "tenant-a"
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it("requires storekeeper role before issuePartRequest", async () => {
      const partsMock = createWorkOrderPartsServiceMock();
      partsMock.assertStorekeeperCanIssue.mockImplementation(() => {
        throw new ForbiddenException("Only inventory keepers or managers can issue stock.");
      });

      const prisma = {
        workOrder: { findFirst: jest.fn().mockResolvedValue({ id: "wo-1", status: WorkOrderStatus.IN_PROGRESS }) },
        partRequest: { findFirst: jest.fn() }
      };

      const service = new WorkOrdersService(prisma as any, { createNotification: jest.fn() } as any, partsMock as any, createWorkOrderTaxonomyServiceMock() as any, { addAssignee: jest.fn() } as any);

      await expect(
        service.issuePartRequest("wo-1", "req-1", { quantity: 1 }, {
          sub: "tech-1",
          email: "tech@x.com",
          role: RoleName.TECHNICIAN,
          tenantId: "tenant-a"
        })
      ).rejects.toThrow(ForbiddenException);

      expect(partsMock.assertStorekeeperCanIssue).toHaveBeenCalled();
    });
  });
});
