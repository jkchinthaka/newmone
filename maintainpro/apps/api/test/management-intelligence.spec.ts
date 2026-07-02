import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { RoleName, VendorInvoiceStatus, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import {
  computeDowntimeHours,
  computeWorkOrderCosts,
  recommendAction,
  repairVsReplaceFlag,
  riskSeverityFromCost
} from "../src/common/utils/management-intelligence-cost.util";
import { ManagementIntelligenceService } from "../src/modules/management-intelligence/management-intelligence.service";

describe("management intelligence (UAT-021)", () => {
  describe("cost utilities", () => {
    it("computes parts, vendor, and labor components", () => {
      const costs = computeWorkOrderCosts({
        parts: [{ usedQuantity: 2, unitCost: 1000 }],
        invoices: [{ totalAmount: 5000, status: VendorInvoiceStatus.APPROVED }],
        actualCost: 1500
      });
      expect(costs.partsCost).toBe(2000);
      expect(costs.vendorCost).toBe(5000);
      expect(costs.laborCost).toBe(1500);
      expect(costs.totalMaintenanceCost).toBe(8500);
    });

    it("computes downtime hours from start and completion", () => {
      const start = new Date("2026-01-01T08:00:00.000Z");
      const end = new Date("2026-01-01T12:00:00.000Z");
      expect(computeDowntimeHours(start, end)).toBe(4);
    });

    it("flags repair vs replace using rule thresholds", () => {
      expect(repairVsReplaceFlag({ cost90Days: 60_000, repeatedCount: 1, downtimeHours: 10 })).toBe(true);
      expect(repairVsReplaceFlag({ cost90Days: 1000, repeatedCount: 1, downtimeHours: 10 })).toBe(false);
    });

    it("recommends management review for high repeated breakdowns", () => {
      expect(
        recommendAction({
          totalCost: 80_000,
          repeatedCount: 4,
          downtimeHours: 20,
          vendorCost: 10_000,
          partsCost: 5_000
        })
      ).toBe("Major overhaul review required");
    });

    it("maps cost and repeats to risk severity", () => {
      expect(riskSeverityFromCost(60_000, 4)).toBe("CRITICAL");
    });
  });

  describe("ManagementIntelligenceService", () => {
    const prisma = {
      workOrder: { findMany: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const service = new ManagementIntelligenceService(prisma as any);

    const manager = { sub: "mgr-1", email: "mgr@test.com", role: RoleName.MANAGER, tenantId: "tenant-1" };
    const technician = { sub: "tech-1", email: "tech@test.com", role: RoleName.TECHNICIAN, tenantId: "tenant-1" };

    beforeEach(() => {
      jest.clearAllMocks();
      prisma.workOrder.findMany.mockResolvedValue([
        {
          id: "wo-1",
          woNumber: "WO-1001",
          title: "Brake repair",
          status: WorkOrderStatus.COMPLETED,
          priority: "HIGH",
          type: WorkOrderType.CORRECTIVE,
          categoryNameSnapshot: "Fleet / Vehicle",
          typeNameSnapshot: "Brake Repair",
          issueNameSnapshot: "Pads worn",
          assetId: "asset-1",
          vehicleId: null,
          technicianId: "tech-1",
          actualCost: 2000,
          createdAt: new Date("2026-01-10T10:00:00.000Z"),
          completedDate: new Date("2026-01-10T14:00:00.000Z"),
          startDate: new Date("2026-01-10T10:00:00.000Z"),
          asset: {
            id: "asset-1",
            name: "Forklift A",
            currentValue: 500_000,
            location: "Colombo",
            departmentId: "dept-1",
            departmentRef: { id: "dept-1", name: "Logistics" }
          },
          vehicle: null,
          technician: { id: "tech-1", firstName: "Tech", lastName: "One" },
          parts: [{ usedQuantity: 2, unitCost: 1500, issuedQuantity: 2 }],
          vendorRepairCase: null,
          assignees: []
        },
        {
          id: "wo-2",
          woNumber: "WO-1002",
          title: "Brake repair repeat",
          status: WorkOrderStatus.COMPLETED,
          priority: "CRITICAL",
          type: WorkOrderType.CORRECTIVE,
          categoryNameSnapshot: "Fleet / Vehicle",
          typeNameSnapshot: "Brake Repair",
          issueNameSnapshot: "Pads worn",
          assetId: "asset-1",
          vehicleId: null,
          technicianId: "tech-1",
          actualCost: 2500,
          createdAt: new Date("2026-01-20T10:00:00.000Z"),
          completedDate: new Date("2026-01-20T16:00:00.000Z"),
          startDate: new Date("2026-01-20T10:00:00.000Z"),
          asset: {
            id: "asset-1",
            name: "Forklift A",
            currentValue: 500_000,
            location: "Colombo",
            departmentId: "dept-1",
            departmentRef: { id: "dept-1", name: "Logistics" }
          },
          vehicle: null,
          technician: { id: "tech-1", firstName: "Tech", lastName: "One" },
          parts: [{ usedQuantity: 1, unitCost: 2000, issuedQuantity: 1 }],
          vendorRepairCase: {
            supplierId: "vendor-1",
            emergencyOverride: false,
            supplier: { id: "vendor-1", name: "Brake Masters" },
            invoices: [{ totalAmount: 8000, status: VendorInvoiceStatus.APPROVED, invoiceAmount: 8000 }]
          },
          assignees: []
        }
      ]);
      prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
    });

    it("blocks technician from management profitability reports", async () => {
      await expect(service.getProfitabilitySummary(technician, {})).rejects.toThrow(ForbiddenException);
    });

    it("builds profitability summary cards for managers", async () => {
      const result = await service.getProfitabilitySummary(manager, {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31"
      });
      expect(result.cards.some((card) => card.key === "total-cost")).toBe(true);
      expect(result.topAssets.length).toBeGreaterThan(0);
      expect(result.disclaimer).toContain("Rule-based");
    });

    it("aggregates cost by department", async () => {
      const result = await service.getCostByDepartment(manager, { dateFrom: "2026-01-01", dateTo: "2026-01-31" });
      expect(result.rows[0]?.departmentName).toBe("Logistics");
      expect(Number(result.rows[0]?.totalMaintenanceCost)).toBeGreaterThan(0);
    });

    it("detects repeated breakdowns within window", async () => {
      const result = await service.getRepeatedBreakdowns(manager, {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31",
        repeatWindowDays: 60
      });
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it("exports CSV and writes audit event", async () => {
      const exported = await service.exportReport(manager, "top-high-cost-assets", {
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31"
      });
      expect(exported.content).toContain("Report: top-high-cost-assets");
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it("rejects export when no rows available", async () => {
      prisma.workOrder.findMany.mockResolvedValueOnce([]);
      await expect(
        service.exportReport(manager, "top-high-cost-assets", { dateFrom: "2026-01-01", dateTo: "2026-01-31" })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
