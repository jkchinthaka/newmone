import { ForbiddenException } from "@nestjs/common";

import { EnterpriseGovernanceService } from "../src/modules/enterprise-governance/enterprise-governance.service";

describe("enterprise governance SoD", () => {
  it("blocks self-approval of meter corrections by default", async () => {
    const prisma = {
      soDPolicy: { findMany: jest.fn().mockResolvedValue([]) }
    } as never;
    const gov = new EnterpriseGovernanceService(prisma);
    await expect(
      gov.assertSoD("t1", "METER_CORRECTION", {
        actorId: "user-a",
        subject: { requestedById: "user-a" }
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows different actor for meter correction approval", async () => {
    const prisma = {
      soDPolicy: { findMany: jest.fn().mockResolvedValue([]) }
    } as never;
    const gov = new EnterpriseGovernanceService(prisma);
    await expect(
      gov.assertSoD("t1", "METER_CORRECTION", {
        actorId: "approver",
        subject: { requestedById: "requester" }
      })
    ).resolves.toBeUndefined();
  });
});

describe("enterprise governance custom fields", () => {
  it("rejects executable-looking field types", async () => {
    const prisma = {
      customFieldDefinition: { upsert: jest.fn() }
    } as never;
    const gov = new EnterpriseGovernanceService(prisma);
    await expect(
      gov.upsertCustomField(
        { sub: "u1", tenantId: "t1", role: "ADMIN" },
        {
          entityType: "ASSET",
          key: "evil",
          label: "Evil",
          fieldType: "script"
        }
      )
    ).rejects.toThrow(/fieldType/);
  });
});

describe("enterprise governance search", () => {
  it("returns empty for short queries", async () => {
    const gov = new EnterpriseGovernanceService({} as never);
    const result = await gov.globalSearch({ sub: "u1", tenantId: "t1", role: "ADMIN" }, "a");
    expect(result.results).toEqual([]);
  });
});
