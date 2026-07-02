import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  assertMakerCheckerSeparation,
  assertReasonProvided,
  FRAUD_AUDIT_EVENTS,
  FRAUD_CONTROL_ENABLED
} from "../src/common/utils/fraud-control.util";
import { calculateWorkOrderRiskScore, resolveRiskSeverity } from "../src/common/utils/maintenance-risk-score";
import { assertIssueQuantity } from "../src/common/utils/work-order-parts-governance";
import { FraudControlService } from "../src/modules/fraud-control/fraud-control.service";
import { InventoryService } from "../src/modules/inventory/inventory.service";

describe("fraud control (UAT-020)", () => {
  describe("fraud-control.util", () => {
    it("requires override reason with minimum length", () => {
      expect(() => assertReasonProvided("Override reason", "ab")).toThrow(BadRequestException);
      expect(() => assertReasonProvided("Override reason", "Valid emergency reason")).not.toThrow();
    });

    it("blocks same user request and approve for maker-checker flows", () => {
      expect(() =>
        assertMakerCheckerSeparation({
          requesterId: "user-1",
          approverId: "user-1",
          approverRole: RoleName.MANAGER,
          flow: "part request"
        })
      ).toThrow(ForbiddenException);
    });

    it("allows admin self-approval only for super admin role", () => {
      expect(() =>
        assertMakerCheckerSeparation({
          requesterId: "admin-1",
          approverId: "admin-1",
          approverRole: RoleName.SUPER_ADMIN,
          flow: "part request"
        })
      ).not.toThrow();
    });

    it("exposes standard fraud audit event keys", () => {
      expect(FRAUD_AUDIT_EVENTS.PARTS_ISSUE_BLOCKED_NO_WORK_ORDER).toBe("parts_issue_blocked_no_work_order");
      expect(FRAUD_AUDIT_EVENTS.MAKER_CHECKER_VIOLATION_BLOCKED).toBe("maker_checker_violation_blocked");
      expect(FRAUD_CONTROL_ENABLED).toBe(true);
    });
  });

  describe("maintenance risk score UAT-020 weights", () => {
    it("scores parts issue without work order as high risk", () => {
      const score = calculateWorkOrderRiskScore({ partsIssueWithoutWorkOrderAttempt: true });
      expect(score).toBe(30);
      expect(resolveRiskSeverity(score)).toBe("MEDIUM");
    });

    it("scores combined fraud factors as critical", () => {
      const score = calculateWorkOrderRiskScore({
        partsIssueWithoutWorkOrderAttempt: true,
        duplicateInvoice: true,
        makerCheckerViolation: true
      });
      expect(score).toBeGreaterThanOrEqual(60);
      expect(resolveRiskSeverity(score)).toBe("CRITICAL");
    });
  });

  describe("assertIssueQuantity", () => {
    it("blocks issue quantity above approved without override reason", () => {
      expect(() => assertIssueQuantity(5, 0, 6)).toThrow(BadRequestException);
      expect(() => assertIssueQuantity(5, 0, 6, "Emergency issue approved by manager")).not.toThrow();
    });
  });

  describe("InventoryService.stockOut", () => {
    const prisma = {
      sparePart: { findFirst: jest.fn() },
      workOrder: { findFirst: jest.fn() },
      stockMovement: { create: jest.fn() },
      auditLog: { create: jest.fn() }
    };

    const service = new InventoryService(prisma as any, { createNotification: jest.fn() } as any, {} as any);

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.sparePart.findFirst.mockResolvedValue({
        id: "part-1",
        quantityInStock: 10,
        tenantId: "tenant-1",
        isActive: true
      });
    });

    it("blocks stock issue without work order id", async () => {
      prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

      await expect(service.stockOut("part-1", 2, {}, { sub: "u1", email: "u1@test.com", role: RoleName.INVENTORY_KEEPER, tenantId: "tenant-1" })).rejects.toThrow(
        "Parts cannot be issued without a valid work order"
      );

      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("blocks negative stock", async () => {
      prisma.workOrder.findFirst.mockResolvedValue({ id: "wo-1", status: "IN_PROGRESS", woNumber: "WO-1" });
      prisma.auditLog.create.mockResolvedValue({ id: "audit-2" });

      await expect(
        service.stockOut(
          "part-1",
          20,
          { workOrderId: "wo-1" },
          { sub: "u1", email: "u1@test.com", role: RoleName.INVENTORY_KEEPER, tenantId: "tenant-1" }
        )
      ).rejects.toThrow("Stock quantity cannot go below 0");
    });
  });

  describe("FraudControlService", () => {
    it("builds dashboard alerts from maintenance exceptions and parts metrics", async () => {
      const maintenanceReports = {
        getExceptionsSummary: jest.fn().mockResolvedValue({
          cards: [{ type: "duplicate-part-requests", count: 2, severity: "MEDIUM", label: "Dup", lastUpdated: "2026-01-01" }]
        })
      };
      const workOrderPartsService = {
        getPartsExceptions: jest.fn().mockResolvedValue({
          partsIssuedWithoutWorkOrderAttempt: 3,
          duplicatePartRequests: 2
        })
      };
      const prisma = {
        auditLog: {
          findMany: jest.fn().mockResolvedValue([
            { metadata: { event: "parts_issue_blocked_no_work_order" } },
            { metadata: { event: "maker_checker_violation_blocked" } }
          ])
        }
      };

      const service = new FraudControlService(prisma as any, maintenanceReports as any, workOrderPartsService as any);
      const result = await service.getDashboard({ sub: "u1", email: "m@test.com", role: RoleName.MANAGER, tenantId: "t1" });

      expect(result.summary.blockedAttempts).toBeGreaterThanOrEqual(1);
      expect(result.alerts.some((alert) => alert.key === "parts-issue-without-work-order")).toBe(true);
    });
  });
});
