import "reflect-metadata";

import { ComplianceStatus } from "@prisma/client";

import { ComplianceService } from "../src/modules/compliance/compliance.service";

describe("ComplianceService.fleetSummary", () => {
  it("counts notAssessed vehicles so category cards sum to total", async () => {
    const prisma = {
      vehicle: {
        count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
          if (where.complianceStatus === ComplianceStatus.COMPLIANT) return 2;
          if (where.complianceStatus === ComplianceStatus.ATTENTION_REQUIRED) return 1;
          if (where.complianceStatus === ComplianceStatus.NON_COMPLIANT) return 1;
          return 5;
        })
      }
    };

    const service = new ComplianceService(prisma as never);
    const summary = await service.fleetSummary({
      sub: "user-1",
      email: "admin@example.com",
      role: "ADMIN",
      tenantId: "tenant-a"
    });

    expect(summary.total).toBe(5);
    expect(summary.compliant).toBe(2);
    expect(summary.attention).toBe(1);
    expect(summary.nonCompliant).toBe(1);
    expect(summary.notAssessed).toBe(1);
    expect(summary.compliant + summary.attention + summary.nonCompliant + summary.notAssessed).toBe(summary.total);
  });
});
