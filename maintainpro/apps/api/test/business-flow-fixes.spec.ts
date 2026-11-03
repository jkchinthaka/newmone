import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { EvidenceType } from "@prisma/client";

import { assertStartPhotoPresent } from "../src/common/utils/work-order-evidence-governance";
import {
  distanceMeters,
  isLongLabourSession,
  isPhotoFarFromSite,
  labourSessionMinutes
} from "../src/common/utils/fraud-field-checks";
import { InventoryService, UNVERIFIED_ISSUE_MARKER } from "../src/modules/inventory/inventory.service";
import {
  isPermitApproverRole,
  permitTransitionNeedsAdmin,
  ReliabilityService
} from "../src/modules/reliability/reliability.service";
import { UtilitiesService } from "../src/modules/utilities/utilities.service";
import { jobPermitRiskReasons } from "../src/modules/work-orders/job-permit-risk";

const tenantId = "tenant-1";

describe("start photo follows the same storage rule as completion", () => {
  const original = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = original;
  });

  it("refuses start in production when photo storage is not set up", () => {
    process.env.NODE_ENV = "production";
    expect(() => assertStartPhotoPresent({ items: [], storageEnabled: false })).toThrow(BadRequestException);
    try {
      assertStartPhotoPresent({ items: [], storageEnabled: false });
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: "PHOTO_STORAGE_UNAVAILABLE" });
    }
  });

  it("waives the photo outside production and for an admin override", () => {
    process.env.NODE_ENV = "development";
    expect(() => assertStartPhotoPresent({ items: [], storageEnabled: false })).not.toThrow();
    process.env.NODE_ENV = "production";
    expect(() => assertStartPhotoPresent({ items: [], storageEnabled: false, overrideReason: "Camera broken on site" })).not.toThrow();
  });

  it("still needs a before photo when storage works", () => {
    expect(() => assertStartPhotoPresent({ items: [], storageEnabled: true })).toThrow(BadRequestException);
    expect(() =>
      assertStartPhotoPresent({
        items: [{ evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED", verificationStatus: null }],
        storageEnabled: true
      })
    ).not.toThrow();
  });
});

describe("permit to work rules", () => {
  it("only Admin / Super Admin approve, or resume a suspended permit", () => {
    expect(permitTransitionNeedsAdmin("DRAFT", "APPROVED")).toBe(true);
    expect(permitTransitionNeedsAdmin("SUSPENDED", "ACTIVE")).toBe(true);
    expect(permitTransitionNeedsAdmin("APPROVED", "ACTIVE")).toBe(false);
    expect(permitTransitionNeedsAdmin("ACTIVE", "CLOSED")).toBe(false);
    expect(isPermitApproverRole("ADMIN")).toBe(true);
    expect(isPermitApproverRole("SUPER_ADMIN")).toBe(true);
    expect(isPermitApproverRole("MANAGER")).toBe(false);
    expect(isPermitApproverRole("SUPERVISOR")).toBe(false);
  });

  function permitPrisma(existing: Record<string, unknown>) {
    return {
      workPermit: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data })),
        findMany: jest.fn(),
        updateMany: jest.fn()
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
  }

  const draft = { id: "p-1", tenantId, status: "DRAFT", issuedById: "sup-1", permitNumber: "PTW-000001", workOrderId: "wo-1", validTo: null };

  it("a manager cannot approve", async () => {
    const prisma = permitPrisma(draft);
    const service = new ReliabilityService(prisma as never);
    await expect(
      service.transitionPermit({ sub: "mgr-1", tenantId, role: "MANAGER" }, "p-1", { status: "APPROVED" })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workPermit.update).not.toHaveBeenCalled();
  });

  it("an admin may approve a permit they raised (owner decision)", async () => {
    const prisma = permitPrisma({ ...draft, issuedById: "admin-1" });
    const service = new ReliabilityService(prisma as never);
    const result = await service.transitionPermit({ sub: "admin-1", tenantId, role: "ADMIN" }, "p-1", { status: "APPROVED" });
    expect(result.status).toBe("APPROVED");
  });

  it("another admin approves, the approver is saved and an audit row is written", async () => {
    const prisma = permitPrisma(draft);
    const service = new ReliabilityService(prisma as never);
    const result = await service.transitionPermit({ sub: "admin-1", tenantId, role: "ADMIN" }, "p-1", { status: "APPROVED" });
    expect(result.status).toBe("APPROVED");
    expect(prisma.workPermit.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED", approvedById: "admin-1" }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity: "WorkPermit", entityId: "p-1" }) })
    );
  });

  it("a supervisor can still activate an approved permit without overwriting the approver", async () => {
    const prisma = permitPrisma({ ...draft, status: "APPROVED", approvedById: "admin-1" });
    const service = new ReliabilityService(prisma as never);
    await service.transitionPermit({ sub: "sup-2", tenantId, role: "SUPERVISOR" }, "p-1", { status: "ACTIVE" });
    const data = prisma.workPermit.update.mock.calls[0][0].data;
    expect(data.status).toBe("ACTIVE");
    expect(data.approvedById).toBeUndefined();
  });

  it("closes every open permit when the job ends", async () => {
    const prisma = permitPrisma(draft);
    prisma.workPermit.findMany.mockResolvedValue([
      { id: "p-1", status: "ACTIVE", permitNumber: "PTW-000001" },
      { id: "p-2", status: "DRAFT", permitNumber: "PTW-000002" }
    ]);
    prisma.workPermit.updateMany.mockResolvedValue({ count: 2 });
    const service = new ReliabilityService(prisma as never);
    const closed = await service.closePermitsForWorkOrder({ tenantId, workOrderId: "wo-1", actorId: "admin-1", reason: "Work order closed" });
    expect(closed).toBe(2);
    expect(prisma.workPermit.updateMany).toHaveBeenCalledWith({
      where: { tenantId, id: { in: ["p-1", "p-2"] } },
      data: { status: "CLOSED" }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("a high-risk job needs a permit even with no critical machine (vehicle / service jobs)", async () => {
    const prisma = {
      reliabilityPolicy: {
        findUnique: jest.fn().mockResolvedValue({ tenantId, requirePermitForCriticalAssets: false, permitRequiredCriticalities: "[]" })
      },
      asset: { findFirst: jest.fn() },
      workPermit: { findMany: jest.fn().mockResolvedValue([]) }
    };
    const service = new ReliabilityService(prisma as never);
    await expect(
      service.assertPermitReadyForStart({ tenantId, workOrderId: "wo-1", assetId: null, jobRiskReasons: ["Hot work"] })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.assertPermitReadyForStart({ tenantId, workOrderId: "wo-1", assetId: null, jobRiskReasons: [] })
    ).resolves.toEqual({ required: false, reasons: [] });
  });

  it("job safety flags and template permit text become permit reasons", () => {
    expect(jobPermitRiskReasons({ hotWorkRequired: true, workingAtHeight: true })).toEqual(["Hot work", "Work at height"]);
    expect(jobPermitRiskReasons({ permitReference: "Electrical permit" })).toEqual(['Permit requirement "Electrical permit"']);
    expect(jobPermitRiskReasons({ permitReference: "None" })).toEqual([]);
    expect(jobPermitRiskReasons({})).toEqual([]);
  });
});

describe("parts issued without verified ERP stock are checked by someone else", () => {
  function service(prisma: Record<string, unknown>) {
    const instance = Object.create(InventoryService.prototype) as InventoryService;
    Object.assign(instance as unknown as Record<string, unknown>, { prisma });
    return instance;
  }
  const actor = { sub: "keeper-1", tenantId, role: "INVENTORY_KEEPER", email: "k@example.com" };
  const issue = { id: "audit-1", tenantId, entityId: "part-1", actorId: "tech-1", metadata: `{${UNVERIFIED_ISSUE_MARKER}}` };

  it("records a confirmation once", async () => {
    const prisma = {
      auditLog: {
        findFirst: jest.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({})
      }
    };
    const result = await service(prisma).reviewUnverifiedIssue(actor as never, "audit-1", { outcome: "confirmed" });
    expect(result).toEqual({ id: "audit-1", outcome: "CONFIRMED" });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entity: "PART_STOCK_ISSUE_REVIEW", entityId: "audit-1" }) })
    );
  });

  it("refuses the issuer, a second review, and follow-up without a note", async () => {
    const own = { auditLog: { findFirst: jest.fn().mockResolvedValue({ ...issue, actorId: "keeper-1" }), create: jest.fn() } };
    await expect(service(own).reviewUnverifiedIssue(actor as never, "audit-1", { outcome: "CONFIRMED" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    const twice = { auditLog: { findFirst: jest.fn().mockResolvedValueOnce(issue).mockResolvedValueOnce({ id: "r-1" }), create: jest.fn() } };
    await expect(service(twice).reviewUnverifiedIssue(actor as never, "audit-1", { outcome: "CONFIRMED" })).rejects.toBeInstanceOf(
      ConflictException
    );
    const noNote = { auditLog: { findFirst: jest.fn(), create: jest.fn() } };
    await expect(
      service(noNote).reviewUnverifiedIssue(actor as never, "audit-1", { outcome: "NEEDS_FOLLOW_UP", note: "" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe("field checks", () => {
  it("measures distance and flags photos outside radius plus GPS accuracy", () => {
    const site = { latitude: 6.9271, longitude: 79.8612 };
    expect(distanceMeters(site, site)).toBe(0);
    const nearby = { latitude: 6.9291, longitude: 79.8612 }; // ~222 m north
    expect(isPhotoFarFromSite({ photo: nearby, site }).far).toBe(false);
    const far = { latitude: 6.9451, longitude: 79.8612 }; // ~2 km north
    const result = isPhotoFarFromSite({ photo: { ...far, accuracyMeters: 30 }, site: { ...site, radiusMeters: 500 } });
    expect(result.far).toBe(true);
    expect(result.allowedMeters).toBe(530);
    expect(isPhotoFarFromSite({ photo: { ...far, accuracyMeters: 3000 }, site }).far).toBe(false);
  });

  it("counts corrected minutes first and flags sessions over the limit", () => {
    const startedAt = new Date("2026-10-01T08:00:00Z");
    expect(labourSessionMinutes({ startedAt, durationMinutes: 900, correctedDurationMinutes: 480 })).toBe(480);
    expect(labourSessionMinutes({ startedAt, endedAt: null }, new Date("2026-10-02T08:00:00Z"))).toBe(1440);
    expect(isLongLabourSession(13 * 60)).toBe(true);
    expect(isLongLabourSession(8 * 60)).toBe(false);
  });
});

describe("utility bills list is bounded", () => {
  it("takes the newest 500 by default and at most 1000", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { utilityBill: { findMany }, utilityMeter: { findMany: jest.fn() } };
    const utilities = new UtilitiesService(prisma as never);
    await utilities.bills(tenantId);
    expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 500, orderBy: { createdAt: "desc" } }));
    await utilities.bills(tenantId, { take: 99999, days: 30 });
    const args = findMany.mock.calls[1][0];
    expect(args.take).toBe(1000);
    expect(args.where.createdAt.gte).toBeInstanceOf(Date);
  });
});
