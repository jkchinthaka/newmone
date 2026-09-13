import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { ReportsService } from "../src/modules/reports/reports.service";
import { assertCanExportReport, assertCanViewReportModule, canViewReportModule } from "../src/modules/reports/report-access.matrix";

/**
 * Regression coverage for a real defect introduced (and fixed in the same
 * change) this session: the login/refresh JWT no longer embeds `permissions`
 * (see auth-jwt-payload-size.spec.ts for why -- it bloated cookies past
 * browsers' size limit for high-permission roles). ReportsService's export/
 * view gates read `actor.permissions` from whatever was passed in from
 * req.user, which -- unlike PermissionsGuard -- was NOT already
 * DB-authoritative, so it silently went from "populated" to "always empty"
 * and started 403ing real ADMIN users on report exports in production and
 * in full-stack E2E (E2E-REPORT-010).
 */

describe("report-access.matrix — the exact asymmetry that caused the regression", () => {
  it("VIEW access falls back to role even with zero explicit permissions (why this half kept working)", () => {
    expect(canViewReportModule({ role: RoleName.ADMIN, permissions: [] }, "operations")).toBe(true);
  });

  it("EXPORT access has NO role-only fallback -- zero explicit permissions is a hard 403 (why this half broke)", () => {
    expect(() => assertCanExportReport({ role: RoleName.ADMIN, permissions: [] }, "operations")).toThrow(
      ForbiddenException
    );
  });

  it("EXPORT access succeeds once the actor's real permissions are present", () => {
    expect(() =>
      assertCanExportReport({ role: RoleName.ADMIN, permissions: ["reports.view"] }, "operations")
    ).not.toThrow();
    expect(() =>
      assertCanExportReport({ role: RoleName.ADMIN, permissions: ["reports.export"] }, "operations")
    ).not.toThrow();
  });

  it("assertCanViewReportModule still throws for a role/module combination genuinely out of scope", () => {
    expect(() => assertCanViewReportModule({ role: RoleName.DRIVER, permissions: [] }, "financials")).toThrow(
      ForbiddenException
    );
  });
});

describe("ReportsService — fetches DB-current permissions instead of trusting actor.permissions", () => {
  function buildPrisma(overrides: { permissionKeys?: string[] } = {}) {
    const permissionKeys = overrides.permissionKeys ?? [];
    const emptyFindMany = () => Promise.resolve([]);
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: { permissions: permissionKeys.map((key) => ({ key })) }
        }),
        findMany: emptyFindMany
      },
      workOrder: { findMany: emptyFindMany, count: jest.fn().mockResolvedValue(0) },
      department: { findMany: emptyFindMany },
      driver: { findMany: emptyFindMany },
      asset: { findMany: emptyFindMany },
      vehicle: { findMany: emptyFindMany },
      supplier: { findMany: emptyFindMany },
      sparePart: { findMany: emptyFindMany },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
  }

  const actor = { sub: "user-1", email: "admin@example.com", role: RoleName.ADMIN, tenantId: "tenant-1" };

  it("exportModule succeeds for an actor whose JWT-derived permissions field is empty, as long as the DB role grants export", async () => {
    const prisma = buildPrisma({ permissionKeys: ["reports.export"] });
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);

    // actor has NO permissions field at all -- exactly what req.user looks like
    // post-fix. This must not 403 if the DB-current role actually grants export.
    const result = await service.exportModule(actor as any, "operations", "csv", {});
    expect(result.buffer).toBeDefined();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { role: { select: { permissions: { select: { key: true } } } } }
    });
  });

  it("exportModule still correctly denies an actor whose DB-current role has no export/view permission", async () => {
    const prisma = buildPrisma({ permissionKeys: [] });
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);
    const driverActor = { sub: "user-2", email: "driver@example.com", role: RoleName.DRIVER, tenantId: "tenant-1" };

    await expect(service.exportModule(driverActor as any, "financials", "csv", {})).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("moduleReport (view) succeeds for ADMIN via role fallback even with an empty DB permission set", async () => {
    const prisma = buildPrisma({ permissionKeys: [] });
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);

    const result = await service.moduleReport(actor as any, "operations", {});
    expect(result).toBeDefined();
  });
});
