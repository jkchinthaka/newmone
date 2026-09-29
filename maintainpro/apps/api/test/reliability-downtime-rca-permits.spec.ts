import { BadRequestException, NotFoundException } from "@nestjs/common";

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

describe("work order reliability gate matrix", () => {
  const tenantId = "tenant-1";

  function permitPolicy() {
    return {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL,HIGH",
          requireLotoWhenPermitRequires: true
        })
      }
    };
  }

  it("allows start for a low criticality asset without a permit", async () => {
    const prisma = {
      ...permitPolicy(),
      asset: { findFirst: jest.fn().mockResolvedValue({ criticalityLevel: "LOW", criticality: null }) },
      workPermit: { findMany: jest.fn() }
    } as never;
    const service = new ReliabilityService(prisma);
    const result = await service.assertPermitReadyForStart({ tenantId, workOrderId: "wo-low", assetId: "asset-low" });
    expect(result.required).toBe(false);
  });

  it("blocks an expired permit", async () => {
    const prisma = {
      ...permitPolicy(),
      asset: { findFirst: jest.fn().mockResolvedValue({ criticalityLevel: "CRITICAL", criticality: null }) },
      workPermit: {
        findMany: jest.fn().mockResolvedValue([
          { status: "APPROVED", validFrom: new Date(Date.now() - 7200000), validTo: new Date(Date.now() - 1000) }
        ])
      }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.assertPermitReadyForStart({ tenantId, workOrderId: "wo-1", assetId: "asset-1" })
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: "SAFETY_BLOCK" }) });
  });

  it("scopes permit lookup to the caller tenant", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      ...permitPolicy(),
      asset: { findFirst: jest.fn().mockResolvedValue({ criticalityLevel: "CRITICAL", criticality: null }) },
      workPermit: { findMany }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.assertPermitReadyForStart({ tenantId, workOrderId: "wo-1", assetId: "asset-1" })
    ).rejects.toBeTruthy();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
  });

  it("allows start when isolation is not required", async () => {
    const prisma = {
      reliabilityPolicy: { findUnique: jest.fn().mockResolvedValue({ tenantId, requireLotoWhenPermitRequires: true }) },
      workOrder: { findFirst: jest.fn().mockResolvedValue({ lotoRequired: false, maintenanceTemplateSnapshot: null }) },
      workPermit: { findMany: jest.fn().mockResolvedValue([]) },
      lotoRecord: { findFirst: jest.fn() }
    } as never;
    const service = new ReliabilityService(prisma);
    const result = await service.assertLotoReadyForStart({ tenantId, workOrderId: "wo-1" });
    expect(result.required).toBe(false);
  });

  it("allows start when LOTO is verified for the same tenant", async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: "loto-1", status: "VERIFIED", verifiedById: "lead-1", verifiedAt: new Date() });
    const prisma = {
      reliabilityPolicy: { findUnique: jest.fn().mockResolvedValue({ tenantId, requireLotoWhenPermitRequires: true }) },
      workOrder: { findFirst: jest.fn().mockResolvedValue({ lotoRequired: true, maintenanceTemplateSnapshot: null }) },
      lotoRecord: { findFirst },
      workPermit: { findMany: jest.fn() }
    } as never;
    const service = new ReliabilityService(prisma);
    const result = await service.assertLotoReadyForStart({ tenantId, workOrderId: "wo-1" });
    expect(result.required).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId, status: "VERIFIED" }) }));
  });
});

describe("reliability tenant isolation and RCA cluster", () => {
  const tenantId = "tenant-1";
  const actor = { sub: "admin-1", tenantId, role: "ADMIN" };

  it("rejects a criticality change for an asset outside the tenant", async () => {
    const prisma = { asset: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.setAssetCriticality(actor, "foreign-asset", { criticalityLevel: "LOW", reason: "Reclassified" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an RCA for a work order outside the tenant", async () => {
    const prisma = { workOrder: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.createRca(actor, { workOrderId: "foreign-wo", problemStatement: "Bearing repeat" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects an asset outside the tenant when opening an RCA", async () => {
    const prisma = { asset: { findFirst: jest.fn().mockResolvedValue(null) } } as never;
    const service = new ReliabilityService(prisma);
    await expect(
      service.createRca(actor, { assetId: "foreign-asset", failureCode: "BRG-FAIL", problemStatement: "Repeat" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the existing open RCA for the same cluster", async () => {
    const existing = { id: "rca-1", clusterKey: "asset:asset-1|fault:BRG-FAIL", status: "OPEN", capaActions: [] };
    const create = jest.fn();
    const prisma = {
      asset: { findFirst: jest.fn().mockResolvedValue({ id: "asset-1" }) },
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          tenantId,
          matchSameAsset: true,
          matchSameFaultCode: true,
          repeatWindowDays: 90,
          requireRcaOnRepeat: true,
          repeatAction: "REQUIRE_RCA"
        })
      },
      rcaCase: { findFirst: jest.fn().mockResolvedValue(existing), create }
    } as never;
    const service = new ReliabilityService(prisma);
    const first = await service.createRca(actor, { assetId: "asset-1", failureCode: "brg-fail", problemStatement: "Third failure" });
    const second = await service.createRca(actor, { assetId: "asset-1", failureCode: "BRG-FAIL", problemStatement: "Retry" });
    expect(first.id).toBe("rca-1");
    expect(second.id).toBe("rca-1");
    expect(create).not.toHaveBeenCalled();
  });

  it("stores manager review as a distinct repeat action", async () => {
    const update = jest.fn().mockResolvedValue({ id: "pol-1", repeatAction: "MANAGER_REVIEW", requireRcaOnRepeat: false });
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          id: "pol-1",
          tenantId,
          repeatWindowDays: 90,
          matchSameFaultCode: true,
          matchSameAsset: true,
          requireRcaOnRepeat: false,
          repeatAction: "FLAG_ONLY",
          requirePermitForCriticalAssets: true,
          permitRequiredCriticalities: "CRITICAL,HIGH"
        }),
        update
      },
      configChangeHistory: { count: jest.fn().mockResolvedValue(1), create: jest.fn() }
    } as never;
    const service = new ReliabilityService(prisma);
    await service.updatePolicy(actor, { repeatAction: "MANAGER_REVIEW", reason: "Review before RCA" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ repeatAction: "MANAGER_REVIEW", requireRcaOnRepeat: false })
      })
    );
  });

  it("reopens an RCA when effectiveness is ineffective and does not close it from CAPA", async () => {
    const rcaUpdate = jest.fn().mockResolvedValue({ id: "rca-1", status: "OPEN", effectiveness: "INEFFECTIVE", capaActions: [] });
    const capaUpdate = jest.fn().mockResolvedValue({ id: "capa-1", status: "VERIFIED", rcaCaseId: "rca-1" });
    const prisma = {
      rcaCase: {
        findFirst: jest.fn().mockResolvedValue({ id: "rca-1", tenantId, status: "COMPLETED", effectiveness: null }),
        update: rcaUpdate
      },
      capaAction: {
        findFirst: jest.fn().mockResolvedValue({ id: "capa-1", tenantId, rcaCaseId: "rca-1", status: "IN_PROGRESS" }),
        update: capaUpdate
      },
      configChangeHistory: { count: jest.fn().mockResolvedValue(0), create: jest.fn() }
    } as never;
    const service = new ReliabilityService(prisma);
    await service.updateCapa(actor, "capa-1", { status: "VERIFIED", verificationNote: "Installed" });
    expect(rcaUpdate).not.toHaveBeenCalled();
    const verified = await service.verifyEffectiveness(actor, "rca-1", { result: "INEFFECTIVE", notes: "Failed again" });
    expect(verified.status).toBe("OPEN");
    expect(rcaUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "OPEN" }) }));
  });

  it("rejects a foreign RCA, CAPA, permit, and LOTO id", async () => {
    const prisma = {
      rcaCase: { findFirst: jest.fn().mockResolvedValue(null) },
      capaAction: { findFirst: jest.fn().mockResolvedValue(null) },
      workOrder: { findFirst: jest.fn().mockResolvedValue(null) },
      workPermit: { findFirst: jest.fn().mockResolvedValue(null) },
      lotoRecord: { findFirst: jest.fn().mockResolvedValue(null) }
    } as never;
    const service = new ReliabilityService(prisma);
    await expect(service.updateRca(actor, "foreign-rca", { rootCause: "x" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateCapa(actor, "foreign-capa", { status: "IN_PROGRESS" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.createPermit(actor, { workOrderId: "foreign-wo", permitType: "HOT_WORK" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.transitionLoto(actor, "foreign-loto", { status: "ISOLATED" })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.transitionPermit(actor, "foreign-permit", { status: "APPROVED" })).rejects.toBeInstanceOf(NotFoundException);
  });
});

