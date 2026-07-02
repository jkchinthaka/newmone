import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  DeliveryChecklistCategory,
  DeliveryItemStatus,
  DeliveryReadinessVerdict,
  RoleName
} from "@prisma/client";

import { DeliveryReadinessService } from "../src/modules/delivery-readiness/delivery-readiness.service";
import { DELIVERY_CATEGORY_CATALOG } from "../src/modules/delivery-readiness/delivery.constants";

const mockCtx: {
  actorId: string;
  actorRole: RoleName;
  tenantId: string;
  permissions: string[];
} = {
  actorId: "admin-1",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-1",
  permissions: ["delivery.manage", "delivery.view", "delivery.export", "delivery.sign_off", "delivery.accept_risk"]
};

jest.mock("../src/common/context/request-context", () => ({
  requestContext: {
    get: jest.fn(() => mockCtx)
  }
}));

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: "item-1",
  checklistId: "chk-1",
  tenantId: "tenant-1",
  title: "Login works",
  description: "Valid credentials authenticate",
  category: DeliveryChecklistCategory.CORE_FUNCTIONS,
  status: DeliveryItemStatus.NOT_STARTED,
  evidence: null,
  notes: null,
  testedByUserId: null,
  testedRole: null,
  testedEnvironment: null,
  deviceSize: null,
  responseTimeMs: null,
  usabilityRating: null,
  blocker: true,
  requiredForDelivery: true,
  signOffRequired: false,
  acceptedRiskReason: null,
  acceptedByUserId: null,
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const buildPrisma = () => {
  const prisma: Record<string, any> = {
    deliveryChecklist: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    deliveryChecklistItem: {
      count: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn()
    },
    deliverySignOff: {
      create: jest.fn()
    },
    qaIssue: {
      count: jest.fn().mockResolvedValue(0)
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: "audit-1" })
    }
  };
  return prisma;
};

describe("DeliveryReadinessService (UAT-026)", () => {
  beforeEach(() => {
    mockCtx.actorId = "admin-1";
    mockCtx.actorRole = RoleName.ADMIN;
    mockCtx.tenantId = "tenant-1";
    mockCtx.permissions = [
      "delivery.manage",
      "delivery.view",
      "delivery.export",
      "delivery.sign_off",
      "delivery.accept_risk"
    ];
  });

  it("exposes all 17 delivery categories", () => {
    const service = new DeliveryReadinessService(buildPrisma() as never);
    const categories = service.getCategories();
    expect(categories).toHaveLength(17);
    expect(DELIVERY_CATEGORY_CATALOG).toHaveLength(17);
  });

  it("creates checklist", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklist.count.mockResolvedValue(0);
    prisma.deliveryChecklist.create.mockResolvedValue({
      id: "chk-1",
      checklistNo: "DR-0001",
      title: "Custom checklist",
      category: DeliveryChecklistCategory.SECURITY,
      items: []
    });

    const service = new DeliveryReadinessService(prisma as never);
    const result = await service.createChecklist({
      title: "Custom checklist",
      category: DeliveryChecklistCategory.SECURITY
    });

    expect(result.checklistNo).toBe("DR-0001");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("creates checklist item", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklist.findFirst.mockResolvedValue({ id: "chk-1", tenantId: "tenant-1" });
    prisma.deliveryChecklistItem.create.mockResolvedValue(buildItem({ id: "item-2" }));

    const service = new DeliveryReadinessService(prisma as never);
    const item = await service.addItem("chk-1", {
      title: "CORS configured",
      category: DeliveryChecklistCategory.SECURITY,
      blocker: true
    });

    expect(item.id).toBe("item-2");
  });

  it("updates checklist item to PASS", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findFirst.mockResolvedValue(buildItem());
    prisma.deliveryChecklistItem.update.mockResolvedValue(buildItem({ status: DeliveryItemStatus.PASS }));

    const service = new DeliveryReadinessService(prisma as never);
    const updated = await service.completeItem("item-1", { notes: "Verified in staging" });

    expect(updated.status).toBe(DeliveryItemStatus.PASS);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_item_passed" })
        })
      })
    );
  });

  it("updates checklist item to FAIL", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findFirst.mockResolvedValue(buildItem());
    prisma.deliveryChecklistItem.update.mockResolvedValue(buildItem({ status: DeliveryItemStatus.FAIL }));

    const service = new DeliveryReadinessService(prisma as never);
    const updated = await service.failItem("item-1", {
      reason: "Login failed for technician role during UAT."
    });

    expect(updated.status).toBe(DeliveryItemStatus.FAIL);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_item_failed" })
        })
      })
    );
  });

  it("blocks final ready when critical item failed", async () => {
    const prisma = buildPrisma();
    prisma.qaIssue.count.mockResolvedValue(0);

    const service = new DeliveryReadinessService(prisma as never);
    const verdict = await service.computeVerdict([
      buildItem({ status: DeliveryItemStatus.FAIL, blocker: true, requiredForDelivery: true })
    ]);

    expect(verdict).toBe(DeliveryReadinessVerdict.NOT_READY);
  });

  it("accepted risk requires manager approval", async () => {
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.permissions = ["delivery.view"];

    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findFirst.mockResolvedValue(buildItem());

    const service = new DeliveryReadinessService(prisma as never);
    await expect(
      service.acceptRisk("item-1", { reason: "Accepting SMTP limitation for pilot rollout period." })
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows manager to accept risk", async () => {
    mockCtx.actorRole = RoleName.MANAGER;
    mockCtx.permissions = ["delivery.view", "delivery.accept_risk"];

    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findFirst.mockResolvedValue(buildItem());
    prisma.deliveryChecklistItem.update.mockResolvedValue(
      buildItem({ status: DeliveryItemStatus.ACCEPTED_RISK })
    );

    const service = new DeliveryReadinessService(prisma as never);
    const updated = await service.acceptRisk("item-1", {
      reason: "Client accepts email delay limitation for first week."
    });

    expect(updated.status).toBe(DeliveryItemStatus.ACCEPTED_RISK);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_risk_accepted" })
        })
      })
    );
  });

  it("sign-off creates record when no blockers", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findMany.mockResolvedValue([
      buildItem({ status: DeliveryItemStatus.PASS, blocker: false })
    ]);
    prisma.deliverySignOff.create.mockResolvedValue({
      id: "sign-1",
      readinessVerdict: DeliveryReadinessVerdict.FULL_COMPANY_LIVE_READY
    });

    const service = new DeliveryReadinessService(prisma as never);
    const record = await service.signOff({ notes: "Client accepted handover pack." });

    expect(record.id).toBe("sign-1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_signoff_created" })
        })
      })
    );
  });

  it("blocks sign-off when critical blockers remain", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklistItem.findMany.mockResolvedValue([
      buildItem({ status: DeliveryItemStatus.BLOCKED, blocker: true, requiredForDelivery: true })
    ]);

    const service = new DeliveryReadinessService(prisma as never);
    await expect(service.signOff({ notes: "Attempted sign-off with open blockers." })).rejects.toThrow(
      BadRequestException
    );
  });

  it("final report returns verdict", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklist.findFirst.mockResolvedValue({
      id: "chk-1",
      title: "MaintainPro Client Delivery Readiness",
      tenantId: "tenant-1"
    });
    prisma.deliveryChecklistItem.count.mockResolvedValue(10);
    prisma.deliveryChecklistItem.findMany.mockResolvedValue([buildItem({ status: DeliveryItemStatus.PASS })]);
    prisma.deliveryChecklist.findFirst
      .mockResolvedValueOnce({ id: "chk-1", title: "MaintainPro Client Delivery Readiness" })
      .mockResolvedValueOnce({
        id: "chk-1",
        items: [buildItem({ status: DeliveryItemStatus.PASS })]
      });

    const service = new DeliveryReadinessService(prisma as never);
    const report = await service.getFinalReport();

    expect(report.verdict).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_verdict_generated" })
        })
      })
    );
  });

  it("blocks unauthorized user", async () => {
    mockCtx.actorRole = RoleName.TECHNICIAN;
    mockCtx.permissions = [];

    const service = new DeliveryReadinessService(buildPrisma() as never);
    await expect(service.getDashboard()).rejects.toThrow(ForbiddenException);
  });

  it("export writes audit event", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklist.findFirst.mockResolvedValue({
      id: "chk-1",
      title: "MaintainPro Client Delivery Readiness",
      items: []
    });
    prisma.deliveryChecklistItem.count.mockResolvedValue(5);
    prisma.deliveryChecklistItem.findMany.mockResolvedValue([buildItem({ status: DeliveryItemStatus.PASS })]);

    const service = new DeliveryReadinessService(prisma as never);
    const exported = await service.exportReport();

    expect(exported.exportedAt).toBeDefined();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ event: "delivery_report_exported" })
        })
      })
    );
  });

  it("returns not found for missing checklist", async () => {
    const prisma = buildPrisma();
    prisma.deliveryChecklist.findFirst.mockResolvedValue(null);

    const service = new DeliveryReadinessService(prisma as never);
    await expect(service.findOneChecklist("missing")).rejects.toThrow(NotFoundException);
  });
});
