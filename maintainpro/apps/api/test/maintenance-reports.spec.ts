import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import {
  calculateWorkOrderRiskScore,
  cardSeverityFromCount,
  resolveRiskSeverity
} from "../src/common/utils/maintenance-risk-score";
import { MaintenanceReportsService } from "../src/modules/reports/maintenance-reports.service";

describe("maintenance-risk-score (UAT-011)", () => {
  it("calculates cumulative risk score from factors", () => {
    const score = calculateWorkOrderRiskScore({
      completedWithoutEvidence: true,
      partsIssuedJobNotCompleted: true,
      overdue: true
    });
    expect(score).toBe(45);
    expect(resolveRiskSeverity(score)).toBe("HIGH");
  });

  it("maps severity bands", () => {
    expect(resolveRiskSeverity(0)).toBe("LOW");
    expect(resolveRiskSeverity(25)).toBe("MEDIUM");
    expect(resolveRiskSeverity(45)).toBe("HIGH");
    expect(resolveRiskSeverity(65)).toBe("CRITICAL");
  });

  it("assigns card severity from count and type", () => {
    expect(cardSeverityFromCount("completed-without-evidence", 0)).toBe("LOW");
    expect(cardSeverityFromCount("completed-without-evidence", 2)).toBe("HIGH");
    expect(cardSeverityFromCount("duplicate-part-requests", 10)).toBe("CRITICAL");
  });
});

describe("MaintenanceReportsService RBAC (UAT-011)", () => {
  const prisma = {
    workOrder: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    workOrderPart: { findMany: jest.fn(), count: jest.fn() },
    workOrderAssignee: { count: jest.fn(), findMany: jest.fn() },
    auditLog: { create: jest.fn() }
  };
  const workforcePlanning = { getWorkloadSummary: jest.fn().mockResolvedValue({ rows: [] }) };
  const service = new MaintenanceReportsService(prisma as any, workforcePlanning as any);

  it("blocks technicians from management reports", () => {
    expect(() =>
      service.assertReportAccess({
        sub: "t1",
        email: "tech@x.com",
        role: RoleName.TECHNICIAN,
        tenantId: "tenant-a"
      })
    ).toThrow(ForbiddenException);
  });

  it("allows managers to access full reports", () => {
    expect(
      service.assertReportAccess({
        sub: "m1",
        email: "mgr@x.com",
        role: RoleName.MANAGER,
        tenantId: "tenant-a"
      })
    ).toBeDefined();
  });

  it("allows inventory keepers to access parts reports", () => {
    expect(
      service.assertReportAccess(
        {
          sub: "k1",
          email: "store@x.com",
          role: RoleName.INVENTORY_KEEPER,
          tenantId: "tenant-a"
        },
        "parts"
      )
    ).toBeDefined();
  });
});
