import { TenantFeaturesService } from "../src/modules/maintenance-config/tenant-features.service";
import { MaintenanceTemplatesService } from "../src/modules/maintenance-config/maintenance-templates.service";
import { WarrantiesService } from "../src/modules/warranties/warranties.service";

describe("tenant feature flags", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "admin-1", tenantId, role: "ADMIN" };

  it("upserts flag and records config history", async () => {
    const createHistory = jest.fn().mockResolvedValue({});
    const prisma = {
      tenantFeatureFlag: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ff-1",
          tenantId,
          code: "FLEET",
          enabled: true,
          name: "Fleet"
        }),
        upsert: jest.fn().mockResolvedValue({
          id: "ff-1",
          tenantId,
          code: "FLEET",
          enabled: false,
          name: "Fleet / Vehicles"
        }),
        findMany: jest.fn(),
        upsertMany: jest.fn()
      },
      configChangeHistory: {
        count: jest.fn().mockResolvedValue(0),
        create: createHistory
      }
    } as never;

    // bypass ensureDefaults noise
    const service = new TenantFeaturesService(prisma);
    jest.spyOn(service, "ensureDefaults").mockResolvedValue(undefined as never);

    const saved = await service.upsert(actor, {
      code: "FLEET",
      enabled: false,
      reason: "Disable fleet for pilot tenant"
    });
    expect(saved.enabled).toBe(false);
    expect(createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "TenantFeatureFlag",
          reason: "Disable fleet for pilot tenant"
        })
      })
    );
  });

  it("isEnabled respects effective window", async () => {
    const future = new Date(Date.now() + 86400000);
    const prisma = {
      tenantFeatureFlag: {
        findUnique: jest.fn().mockResolvedValue({
          id: "ff-2",
          enabled: true,
          effectiveFrom: future,
          effectiveTo: null
        }),
        upsert: jest.fn()
      }
    } as never;
    const service = new TenantFeaturesService(prisma);
    jest.spyOn(service, "ensureDefaults").mockResolvedValue(undefined as never);
    await expect(service.isEnabled(tenantId, "GATE")).resolves.toBe(false);
  });
});

describe("maintenance templates", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "admin-1", tenantId, role: "ADMIN" };

  it("freezes snapshot content used by work orders", async () => {
    const service = new MaintenanceTemplatesService({} as never);
    const snapshot = service.buildSnapshot({
      id: "tpl-1",
      code: "GEN_MONTHLY",
      name: "Generator Monthly",
      version: 3,
      jobDomain: "MACHINERY",
      jobType: "PREVENTIVE",
      categoryCode: "CORRECTIVE",
      subcategoryCode: "GENERATOR",
      defaultPriority: "HIGH",
      estimatedHours: 2,
      estimatedDowntimeMin: 60,
      defaultExecutionMode: "INTERNAL",
      requiredSkillsJson: '["Electrical"]',
      defaultPartsJson: "[]",
      safetyRequirementsJson: '["LOTO"]',
      permitRequirement: "ELECTRICAL",
      checklistTemplateId: null,
      signOffRequirementsJson: '["TECHNICIAN","SUPERVISOR"]',
      instructions: "Check oil",
      documentsJson: "[]"
    });
    expect(snapshot.version).toBe(3);
    expect(snapshot.requiredSkills).toEqual(["Electrical"]);
    expect(snapshot.safetyRequirements).toEqual(["LOTO"]);
    expect(snapshot.snappedAt).toBeTruthy();
  });

  it("revises to a new version without mutating prior code identity", async () => {
    const prisma: Record<string, any> = {
      maintenanceTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: "tpl-v1",
          tenantId,
          code: "GEN_MONTHLY",
          name: "Generator Monthly",
          description: null,
          jobDomain: "MACHINERY",
          jobType: "PREVENTIVE",
          categoryCode: null,
          subcategoryCode: null,
          defaultPriority: "MEDIUM",
          estimatedHours: 2,
          estimatedDowntimeMin: null,
          defaultExecutionMode: null,
          requiredSkillsJson: "[]",
          defaultPartsJson: "[]",
          safetyRequirementsJson: "[]",
          permitRequirement: null,
          checklistTemplateId: null,
          signOffRequirementsJson: "[]",
          instructions: "v1",
          documentsJson: "[]",
          version: 1,
          active: true
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({
          id: "tpl-v2",
          code: "GEN_MONTHLY",
          version: 2,
          name: "Generator Monthly",
          jobDomain: "MACHINERY",
          active: true,
          defaultPriority: "MEDIUM"
        })
      },
      configChangeHistory: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({})
      }
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));

    const service = new MaintenanceTemplatesService(prisma as never);
    const revised = await service.revise(actor, "tpl-v1", {
      instructions: "v2 instructions",
      changeReason: "Clarify oil check"
    });
    expect(revised.version).toBe(2);
    expect(prisma.configChangeHistory.create).toHaveBeenCalled();
  });
});

describe("warranty claims", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "admin-1", tenantId, role: "ADMIN" };

  it("rejects illegal claim transitions", async () => {
    const service = new WarrantiesService({
      warrantyClaim: {
        findFirst: jest.fn().mockResolvedValue({
          id: "claim-1",
          tenantId,
          status: "CLOSED"
        })
      }
    } as never);

    await expect(
      service.transitionClaim(actor, "claim-1", { status: "SUBMITTED" })
    ).rejects.toThrow(/Cannot transition/i);
  });

  it("allows ELIGIBLE → PREPARED", async () => {
    const update = jest.fn().mockResolvedValue({
      id: "claim-1",
      status: "PREPARED"
    });
    const service = new WarrantiesService({
      warrantyClaim: {
        findFirst: jest.fn().mockResolvedValue({
          id: "claim-1",
          tenantId,
          status: "ELIGIBLE"
        }),
        update
      },
      configChangeHistory: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({})
      }
    } as never);

    const updated = await service.transitionClaim(actor, "claim-1", {
      status: "PREPARED",
      reason: "Documents ready"
    });
    expect(updated.status).toBe("PREPARED");
    expect(update).toHaveBeenCalled();
  });
});
