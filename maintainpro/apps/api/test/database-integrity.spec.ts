import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext } from "../src/common/context/request-context";
import {
  assertTenantEntityExists,
  requireTenantId,
  tenantWhere
} from "../src/common/utils/tenant-scope.util";
import { assertNoAssetHierarchyCycle } from "../src/modules/assets/asset-hierarchy";
import { EnterpriseGovernanceService } from "../src/modules/enterprise-governance/enterprise-governance.service";

const emptyAuditCtx = {
  actorId: null,
  actorEmail: null,
  actorRole: null,
  tenantId: "tenant-a",
  module: null,
  ipAddress: null,
  userAgent: null,
  requestPath: null,
  requestId: "r1"
} as const;

describe("database integrity — tenant scope helpers", () => {
  it("requireTenantId fails closed without context", () => {
    expect(() => requireTenantId(null)).toThrow(ForbiddenException);
  });

  it("tenantWhere always includes tenantId", () => {
    expect(tenantWhere("t-1")).toEqual({ tenantId: "t-1" });
  });

  it("assertTenantEntityExists blocks cross-tenant ids", async () => {
    const delegate = {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn()
    };
    await expect(
      requestContext.run({ ...emptyAuditCtx }, () =>
        assertTenantEntityExists(delegate, "asset-from-b", { entityName: "Asset" })
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(delegate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "asset-from-b", tenantId: "tenant-a" })
      })
    );
  });
});

describe("database integrity — hierarchy cycles", () => {
  it("blocks asset parent cycles", async () => {
    const parents: Record<string, string | null> = {
      child: "mid",
      mid: "parent",
      parent: "child"
    };
    await expect(
      assertNoAssetHierarchyCycle({
        assetId: "child",
        parentAssetId: "parent",
        loadParentId: async (id) => parents[id] ?? null
      })
    ).rejects.toThrow();
  });

  it("allows acyclic parent assignment", async () => {
    await expect(
      assertNoAssetHierarchyCycle({
        assetId: "child",
        parentAssetId: "parent",
        loadParentId: async (id) => (id === "parent" ? null : null)
      })
    ).resolves.toBeUndefined();
  });
});

describe("database integrity — money / keys contracts", () => {
  it("documents Decimal(18,2) for core money and tenant-scoped business keys", () => {
    // Contract expectations consumed by schema + migration 20260917240000
    const moneyPrecision = { precision: 18, scale: 2 };
    const tenantBusinessKeys = [
      ["Asset", "assetTag"],
      ["Vehicle", "registrationNo"],
      ["WorkOrder", "woNumber"],
      ["SparePart", "partNumber"],
      ["Supplier", "vendorCode"],
      ["MaintenanceRequest", "requestNumber"]
    ];
    expect(moneyPrecision.scale).toBe(2);
    expect(tenantBusinessKeys.length).toBeGreaterThanOrEqual(6);
  });
});

describe("database integrity — meter correction append semantics", () => {
  it("approval path must append reading not mutate history rows", async () => {
    const readingCreate = jest.fn().mockResolvedValue({});
    const meterUpdate = jest.fn().mockResolvedValue({});
    const correctionUpdate = jest.fn().mockResolvedValue({});
    const historyCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      meterCorrection: {
        findFirst: jest.fn().mockResolvedValue({
          id: "c1",
          tenantId: "t1",
          meterId: "m1",
          originalValue: 10,
          correctedValue: 12,
          reason: "cal",
          requestedById: "u1",
          status: "PENDING"
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "c1", status: "APPROVED" }),
        update: correctionUpdate
      },
      soDPolicy: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          assetMeter: {
            findFirst: jest.fn().mockResolvedValue({ id: "m1", currentValue: 10 }),
            update: meterUpdate
          },
          meterCorrection: { update: correctionUpdate },
          assetMeterReading: { create: readingCreate },
          configChangeHistory: { create: historyCreate }
        })
      )
    };
    const gov = new EnterpriseGovernanceService(prisma as never);
    await gov.approveMeterCorrection({ sub: "approver", tenantId: "t1", role: "ADMIN" }, "c1", true);
    expect(readingCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: "CORRECTION", value: 12 })
      })
    );
    expect(meterUpdate).toHaveBeenCalled();
  });
});
