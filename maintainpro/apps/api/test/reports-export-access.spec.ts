import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { ReportsService } from "../src/modules/reports/reports.service";

/**
 * Access/refresh JWTs no longer carry permissions, so req.user.permissions is empty
 * in production. The report export/view gates must read the role's permissions from
 * the DB, otherwise a custom role granted reports.export in the Admin Console (but
 * outside the export role allowlist) is refused. Ported from feature/mobile-v2
 * f04c55db and adapted to main's permissionLinks schema.
 */
describe("ReportsService — DB-authoritative report permissions", () => {
  function buildPrisma(permissionKeys: string[]) {
    const emptyFindMany = () => Promise.resolve([]);
    return {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          role: { permissionLinks: permissionKeys.map((key) => ({ permission: { key } })) }
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

  const supervisor = { sub: "user-1", email: "sup@example.com", role: RoleName.SUPERVISOR, tenantId: "tenant-1" };

  it("lets a non-allowlisted role export when its DB role grants reports.export", async () => {
    const prisma = buildPrisma(["reports.view", "reports.export"]);
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);

    const result = await service.exportModule(supervisor as any, "operations", "csv", {});

    expect(result.buffer).toBeDefined();
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
  });

  it("still refuses export when the DB role grants no export permission", async () => {
    const prisma = buildPrisma([]);
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);

    await expect(service.exportModule(supervisor as any, "operations", "csv", {})).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("does not re-query when the caller already supplies permissions", async () => {
    const prisma = buildPrisma([]);
    const service = new ReportsService(prisma as any, {} as any, {} as any, {} as any);

    await service.exportModule({ ...supervisor, permissions: ["reports.view", "reports.export"] } as any, "operations", "csv", {});

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
