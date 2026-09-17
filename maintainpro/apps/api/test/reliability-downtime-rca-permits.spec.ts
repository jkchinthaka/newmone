import { BadRequestException } from "@nestjs/common";

import { ReliabilityService } from "../src/modules/reliability/reliability.service";

describe("reliability downtime segments", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "tech-1", tenantId, role: "TECHNICIAN" };

  it("opens and closes a segment without treating whole WO as active repair", async () => {
    const startedAt = new Date(Date.now() - 2 * 3600000);
    const create = jest.fn().mockResolvedValue({
      id: "seg-1",
      category: "WAITING_PARTS",
      startedAt,
      endedAt: null
    });
    const update = jest.fn().mockResolvedValue({
      id: "seg-1",
      endedAt: new Date()
    });
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          assetId: "asset-1",
          downtimeApplicable: false,
          downtimeStartedAt: null,
          failureCodeSnapshot: null,
          causeCodeSnapshot: null
        }),
        update: jest.fn().mockResolvedValue({})
      },
      downtimeSegment: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: "seg-1",
          tenantId,
          workOrderId: "wo-1",
          startedAt,
          endedAt: null,
          reasonNotes: null
        }),
        create,
        update,
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn()
      }
    } as never;

    const service = new ReliabilityService(prisma);
    const opened = await service.openDowntime(actor, "wo-1", {
      category: "WAITING_PARTS",
      productionAffected: true
    });
    expect(opened.category).toBe("WAITING_PARTS");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: "WAITING_PARTS", assetId: "asset-1" })
      })
    );

    const closed = await service.closeDowntime(actor, "seg-1", {});
    expect(closed.endedAt).toBeTruthy();
    expect(update).toHaveBeenCalled();
  });

  it("rejects a second open segment", async () => {
    const prisma = {
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: "wo-1",
          assetId: null,
          downtimeApplicable: true,
          downtimeStartedAt: new Date(),
          failureCodeSnapshot: null,
          causeCodeSnapshot: null
        })
      },
      downtimeSegment: {
        findFirst: jest.fn().mockResolvedValue({ id: "open-1", endedAt: null })
      }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.openDowntime(actor, "wo-1", { category: "ACTIVE_REPAIR" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("reliability permit start gate", () => {
  const tenantId = "tenant-1";

  it("blocks start when critical asset has no valid permit", async () => {
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL,HIGH"
        })
      },
      asset: {
        findFirst: jest.fn().mockResolvedValue({ criticalityLevel: "CRITICAL", criticality: null })
      },
      workPermit: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as never;

    const service = new ReliabilityService(prisma);
    await expect(
      service.assertPermitReadyForStart({
        tenantId,
        workOrderId: "wo-1",
        assetId: "asset-1"
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "SAFETY_BLOCK" })
    });
  });

  it("allows start when ACTIVE permit is in validity window", async () => {
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL,HIGH"
        })
      },
      asset: {
        findFirst: jest.fn().mockResolvedValue({ criticalityLevel: "HIGH", criticality: null })
      },
      workPermit: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: "ACTIVE",
            validFrom: new Date(Date.now() - 3600000),
            validTo: new Date(Date.now() + 3600000)
          }
        ])
      }
    } as never;

    const service = new ReliabilityService(prisma);
    const result = await service.assertPermitReadyForStart({
      tenantId,
      workOrderId: "wo-1",
      assetId: "asset-1"
    });
    expect(result.required).toBe(true);
    expect(result.reasons).toEqual([]);
  });
});

describe("repeat failure detection", () => {
  const tenantId = "tenant-1";

  it("flags WO when similar failures exist in window", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          repeatWindowDays: 90,
          matchSameFaultCode: true,
          matchSameAsset: true,
          requireRcaOnRepeat: false
        })
      },
      workOrder: {
        count: jest.fn().mockResolvedValue(2),
        updateMany
      }
    } as never;

    const service = new ReliabilityService(prisma);
    const result = await service.detectRepeatFailure({
      tenantId,
      workOrderId: "wo-new",
      assetId: "asset-1",
      failureCode: "BRG-FAIL"
    });
    expect(result.isRepeat).toBe(true);
    expect(result.similarCount).toBe(2);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { repeatFailureCandidate: true }
      })
    );
  });
});

describe("reliability policy history", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "admin-1", tenantId, role: "ADMIN" };

  it("records config history on policy update", async () => {
    const createHistory = jest.fn().mockResolvedValue({});
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: "pol-1",
          tenantId,
          repeatWindowDays: 90,
          matchSameFaultCode: true,
          matchSameAsset: true,
          requireRcaOnRepeat: false,
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL,HIGH"
        }),
        update: jest.fn().mockResolvedValue({
          id: "pol-1",
          tenantId,
          repeatWindowDays: 45,
          matchSameFaultCode: true,
          matchSameAsset: true,
          requireRcaOnRepeat: true,
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL"
        })
      },
      configChangeHistory: {
        count: jest.fn().mockResolvedValue(0),
        create: createHistory
      }
    } as never;

    const service = new ReliabilityService(prisma);
    await service.updatePolicy(actor, {
      repeatWindowDays: 45,
      requireRcaOnRepeat: true,
      permitRequiredCriticalities: ["CRITICAL"],
      reason: "Tighten repeat window"
    });
    expect(createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: "ReliabilityPolicy",
          reason: "Tighten repeat window"
        })
      })
    );
  });
});

describe("condition monitoring evaluation", () => {
  const tenantId = "tenant-1";

  it("creates open event on upper critical breach and dedupes", async () => {
    const create = jest.fn().mockResolvedValue({ id: "evt-1" });
    const update = jest.fn();
    const prisma = {
      conditionMonitoringRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "rule-1",
            name: "Bearing temp",
            measurementType: "TEMPERATURE",
            meterId: null,
            assetId: null,
            upperWarning: 70,
            upperCritical: 90,
            lowerWarning: null,
            lowerCritical: null,
            consecutiveBreaches: 1
          }
        ])
      },
      conditionEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
        update
      }
    } as never;

    const service = new ReliabilityService(prisma);
    const result = await service.evaluateMeterReading({
      tenantId,
      meterId: "m-1",
      assetId: "a-1",
      meterType: "TEMPERATURE",
      value: 95
    });
    expect(result.triggered).toHaveLength(1);
    expect(create).toHaveBeenCalled();
  });
});

describe("LOTO start gate and SoD", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "tech-1", tenantId, role: "TECHNICIAN" };

  it("blocks start when LOTO required and not verified", async () => {
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          requireLotoWhenPermitRequires: true
        })
      },
      workOrder: {
        findFirst: jest.fn().mockResolvedValue({
          maintenanceTemplateSnapshot: JSON.stringify({ safetyRequirements: ["LOTO"] }),
          lotoRequired: true
        })
      },
      lotoRecord: { findFirst: jest.fn().mockResolvedValue(null) },
      workPermit: { findMany: jest.fn().mockResolvedValue([]) }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.assertLotoReadyForStart({ tenantId, workOrderId: "wo-1" })
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "SAFETY_BLOCK" }) });
  });

  it("blocks self-verification of LOTO", async () => {
    const prisma = {
      lotoRecord: {
        findFirst: jest.fn().mockResolvedValue({
          id: "loto-1",
          tenantId,
          status: "ISOLATED",
          isolatedById: "tech-1"
        }),
        update: jest.fn()
      }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.transitionLoto(actor, "loto-1", { status: "VERIFIED" })
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "SOD_VIOLATION" }) });
  });
});
