import { ForbiddenException } from "@nestjs/common";
import { AuditAction, RoleName } from "@prisma/client";

import { rowsToCsv, writeAuditTrail } from "../src/common/utils/audit-trail.util";
import { clampPageSize } from "../src/common/utils/pagination.util";
import { AuditService } from "../src/modules/audit/audit.service";
import { FraudControlService } from "../src/modules/fraud-control/fraud-control.service";
import { ManagementIntelligenceService } from "../src/modules/management-intelligence/management-intelligence.service";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

describe("security RBAC and audit (UAT-022)", () => {
  describe("pagination.util", () => {
    it("enforces max page size", () => {
      expect(clampPageSize(9999)).toBe(100);
      expect(clampPageSize(0)).toBe(20);
    });
  });

  describe("ManagementIntelligenceService RBAC", () => {
    const prisma = { workOrder: { findMany: jest.fn().mockResolvedValue([]) }, auditLog: { create: jest.fn() } };
    const service = new ManagementIntelligenceService(prisma as never);
    const technician = { sub: "t1", email: "t@test.com", role: RoleName.TECHNICIAN, tenantId: "tenant-1" };
    const manager = { sub: "m1", email: "m@test.com", role: RoleName.MANAGER, tenantId: "tenant-1" };

    it("blocks technician from management reports", async () => {
      await expect(service.getProfitabilitySummary(technician, {})).rejects.toThrow(ForbiddenException);
    });

    it("allows manager access", async () => {
      const result = await service.getProfitabilitySummary(manager, {});
      expect(result.cards.length).toBeGreaterThan(0);
    });
  });

  describe("FraudControlService admin overrides export", () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "a1",
            createdAt: new Date("2026-01-15T10:00:00.000Z"),
            actorId: "u1",
            module: "work-orders",
            action: AuditAction.UPDATE,
            entity: "WorkOrder",
            entityId: "wo-1",
            reason: "Emergency override approved",
            metadata: { overrideFlag: true, event: "gate_out_override", source: "WEB" },
            beforeData: { status: "BLOCKED" },
            afterData: { status: "ALLOWED" },
            requestPath: "/api/fleet/gate-out",
            actor: { firstName: "Admin", lastName: "One", role: { name: "ADMIN" } }
          }
        ]),
        create: jest.fn().mockResolvedValue({ id: "export-audit" })
      }
    };
    const maintenanceReports = { getExceptionsSummary: jest.fn() };
    const workOrderPartsService = { getPartsExceptions: jest.fn() };
    const service = new FraudControlService(
      prisma as never,
      maintenanceReports as never,
      workOrderPartsService as never
    );
    const admin = { sub: "a1", email: "admin@test.com", role: RoleName.ADMIN, tenantId: "tenant-1" };

    it("exports CSV and writes export audit", async () => {
      const file = await service.exportAdminOverrides(admin, { dateFrom: "2026-01-01", dateTo: "2026-01-31" });
      expect(file.content).toContain("Report: admin-overrides");
      expect(file.content).toContain("gate_out_override");
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("AuditService export", () => {
    const prisma = {
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "log-1",
            createdAt: new Date(),
            actorId: "u1",
            module: "work-orders",
            entity: "WorkOrder",
            entityId: "wo-1",
            action: AuditAction.UPDATE,
            reason: "status change",
            actor: { email: "mgr@test.com" }
          }
        ]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({ id: "export-1" })
      }
    };
    const service = new AuditService(prisma as never);
    const admin = { sub: "a1", email: "admin@test.com", role: RoleName.ADMIN, tenantId: "tenant-1" };

    it("exports audit logs with audit trail for export action", async () => {
      const file = await service.export(admin, { module: "work-orders" });
      expect(file.content).toContain("Report: audit-logs");
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe("go-live documentation pack", () => {
    const root = path.join(__dirname, "..", "..", "..");
    const requiredDocs = [
      "docs/go-live/permission-matrix.md",
      "docs/go-live/backend-rbac-audit.md",
      "docs/go-live/audit-trail-standard.md",
      "docs/go-live/uat-index.md",
      "docs/go-live/developer-protection/known-limitations.md",
      "docs/go-live/developer-protection/deployment-checklist.md",
      "docs/go-live/developer-protection/rollback-plan.md",
      "docs/go-live/developer-protection/backup-restore-plan.md",
      "docs/go-live/developer-protection/incident-log-template.md",
      "docs/go-live/developer-protection/incident-response-sop.md",
      "docs/go-live/developer-protection/change-request-process.md",
      "docs/go-live/developer-protection/uat-sign-off-template.md",
      "docs/go-live/developer-protection/release-notes-template.md",
      "docs/go-live/developer-protection/production-readiness-checklist.md",
      "docs/go-live/developer-protection/responsibility-matrix.md"
    ];

    it.each(requiredDocs)("includes %s", (relPath) => {
      const full = path.join(root, relPath);
      expect(existsSync(full)).toBe(true);
      expect(readFileSync(full, "utf8").trim().length).toBeGreaterThan(100);
    });
  });
});
