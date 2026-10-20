import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleName, WorkOrderApprovalStatus, WorkOrderStatus, WorkOrderVerificationStatus } from "@prisma/client";
import { Reflector } from "@nestjs/core";

import { hasCompatiblePermission } from "../src/common/guards/permissions.guard";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { WorkOrdersController } from "../src/modules/work-orders/work-orders.controller";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import {
  assertVerifiedIssueAllowed,
  insufficientVerifiedStockMessage,
  sumUnreconciledQuantities,
  verifiedAvailableQuantity
} from "../src/modules/inventory/verified-stock-availability";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

const verifiedAt = new Date("2026-10-01T00:00:00.000Z");

function stockClient(input?: {
  onHand?: number;
  reserved?: number;
  warehouse?: Record<string, unknown> | null;
  events?: Array<{ eventType: string; payload: string; createdAt: Date }>;
  warehouseId?: string;
}) {
  const warehouse =
    input && "warehouse" in input
      ? input.warehouse
      : {
          id: input?.warehouseId ?? "wh-1",
          erpWarehouseCode: "MAIN",
          lastErpValidatedAt: verifiedAt,
          isDefault: true,
          isActive: true
        };
  return {
    warehouse: {
      findFirst: jest.fn().mockResolvedValue(warehouse),
      findMany: jest.fn().mockResolvedValue(warehouse ? [warehouse] : [])
    },
    warehouseItemBalance: {
      findFirst: jest.fn().mockResolvedValue(
        warehouse
          ? { id: "bal-1", onHand: input?.onHand ?? 19, reserved: input?.reserved ?? 0, available: input?.onHand ?? 19 }
          : null
      )
    },
    domainEventOutbox: {
      findMany: jest.fn().mockResolvedValue(input?.events ?? [])
    },
    $queryRaw: jest.fn().mockRejectedValue(new Error("unit mock"))
  };
}

function serviceFor(prisma: Record<string, unknown>) {
  return new WorkOrdersService(
    prisma as never,
    { createNotification: jest.fn() } as never,
    createWorkOrderPartsServiceMock() as never,
    createWorkOrderTaxonomyServiceMock() as never,
    { addAssignee: jest.fn() } as never
  );
}

function woPrisma() {
  return {
    workOrder: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    workOrderLabourEntry: { findMany: jest.fn().mockResolvedValue([]) },
    workOrderStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue({ actorId: "tech-1" })
    },
    evidenceAttachment: {
      findMany: jest.fn().mockResolvedValue([
        { evidenceType: "BEFORE_PHOTO", status: "UPLOADED", verificationStatus: "PENDING" },
        { evidenceType: "AFTER_PHOTO", status: "UPLOADED", verificationStatus: "PENDING" }
      ])
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
    user: { findUnique: jest.fn() }
  };
}

const completed = {
  id: "wo-1",
  tenantId: "tenant-a",
  woNumber: "WO-1",
  approvalStatus: WorkOrderApprovalStatus.APPROVED,
  priority: "MEDIUM",
  type: "CORRECTIVE",
  status: WorkOrderStatus.TECHNICIAN_COMPLETED,
  verificationStatus: WorkOrderVerificationStatus.PENDING,
  actualCost: 100,
  actualHours: 2,
  technicianId: "tech-1",
  version: 3,
  asset: null,
  vehicle: null,
  technician: null,
  createdBy: null,
  parts: []
};

const supervisor = {
  sub: "sup-1",
  email: "sup@maintainpro.local",
  role: RoleName.SUPERVISOR,
  tenantId: "tenant-a"
};

function grant(keys: string[]) {
  return {
    role: {
      name: RoleName.SUPERVISOR,
      permissionLinks: keys.map((key) => ({ permission: { key } }))
    }
  };
}

describe("approved supervisor verification", () => {
  it("SV-01 supervisor with explicit verify can verify", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst
      .mockResolvedValueOnce(completed)
      .mockResolvedValue({ ...completed, status: WorkOrderStatus.VERIFIED, verificationStatus: WorkOrderVerificationStatus.VERIFIED });
    prisma.workOrder.updateMany.mockResolvedValue({ count: 1 });
    const service = serviceFor(prisma);
    const result = await service.verifySupervisor(
      "wo-1",
      { verificationNote: "Checked", expectedVersion: 3 },
      supervisor
    );
    expect(result.status).toBe(WorkOrderStatus.VERIFIED);
    expect(prisma.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WorkOrderStatus.VERIFIED,
          verificationStatus: WorkOrderVerificationStatus.VERIFIED,
          verifiedById: "sup-1",
          verificationNote: "Checked"
        })
      })
    );
  });

  it("SV-02 supervisor without verify permission is forbidden", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant([]));
    await expect(serviceFor(prisma).verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("SV-03 manage alias does not verify a supervisor", async () => {
    expect(hasCompatiblePermission(new Set(["work_orders.manage"]), "work_orders.verify", "SUPERVISOR")).toBe(false);
    expect(hasCompatiblePermission(new Set(["work_orders.manage"]), "work_orders.verify", "MANAGER")).toBe(true);
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.manage"]));
    await expect(serviceFor(prisma).verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-04 technician cannot verify", async () => {
    const prisma = woPrisma();
    await expect(
      serviceFor(prisma).verifySupervisor("wo-1", {}, { ...supervisor, role: RoleName.TECHNICIAN, sub: "tech-1" })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-05 mechanic cannot verify", async () => {
    const prisma = woPrisma();
    await expect(
      serviceFor(prisma).verifySupervisor("wo-1", {}, { ...supervisor, role: RoleName.MECHANIC })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-06 supervisor cannot verify their own completion even with an override reason", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    prisma.workOrderStatusHistory.findFirst.mockResolvedValue({ actorId: "sup-1" });
    await expect(
      serviceFor(prisma).verifySupervisor("wo-1", { sodOverrideReason: "I finished it myself" }, supervisor)
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("SV-07 maker-checker still blocks the completing technician", async () => {
    const prisma = woPrisma();
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    prisma.workOrderStatusHistory.findFirst.mockResolvedValue({ actorId: "tech-1" });
    await expect(
      serviceFor(prisma).verifySupervisor(
        "wo-1",
        {},
        { ...supervisor, role: RoleName.MANAGER, sub: "tech-1" }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-08 manager verification still works without an explicit verify row", async () => {
    const prisma = woPrisma();
    prisma.workOrder.findFirst
      .mockResolvedValueOnce(completed)
      .mockResolvedValue({ ...completed, status: WorkOrderStatus.VERIFIED });
    prisma.workOrder.updateMany.mockResolvedValue({ count: 1 });
    const result = await serviceFor(prisma).verifySupervisor(
      "wo-1",
      { verificationNote: "Manager check", expectedVersion: 3 },
      { ...supervisor, role: RoleName.MANAGER, sub: "manager-1" }
    );
    expect(result.status).toBe(WorkOrderStatus.VERIFIED);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("SV-09 cross-tenant verification is not found", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(null);
    await expect(serviceFor(prisma).verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("SV-10 wrong lifecycle state is rejected", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue({ ...completed, status: WorkOrderStatus.IN_PROGRESS });
    await expect(serviceFor(prisma).verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("SV-11 verification metadata is persisted", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValueOnce(completed).mockResolvedValue({
      ...completed,
      status: WorkOrderStatus.VERIFIED,
      verificationStatus: WorkOrderVerificationStatus.VERIFIED
    });
    prisma.workOrder.updateMany.mockResolvedValue({ count: 1 });
    await serviceFor(prisma).verifySupervisor(
      "wo-1",
      { verificationNote: "On site", expectedVersion: 3 },
      supervisor
    );
    expect(prisma.workOrder.updateMany.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        verifiedById: "sup-1",
        verificationNote: "On site",
        verificationStatus: WorkOrderVerificationStatus.VERIFIED
      })
    );
    expect(prisma.workOrder.updateMany.mock.calls[0][0].data.verifiedAt).toBeInstanceOf(Date);
    expect(prisma.workOrder.updateMany.mock.calls[0][0].data.version).toEqual({ increment: 1 });
    expect(prisma.workOrderStatusHistory.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("SV-12 generic status update cannot verify", async () => {
    const prisma = woPrisma();
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    await expect(
      serviceFor(prisma).updateStatus("wo-1", { status: WorkOrderStatus.VERIFIED }, { ...supervisor, role: RoleName.MANAGER })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-13 bulk status cannot verify or close", async () => {
    const prisma = woPrisma();
    const service = serviceFor(prisma);
    await expect(
      service.bulkStatus({ items: [{ id: "wo-1", expectedVersion: 1 }], targetStatus: WorkOrderStatus.VERIFIED }, supervisor)
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.bulkStatus({ items: [{ id: "wo-1", expectedVersion: 1 }], targetStatus: WorkOrderStatus.CLOSED }, supervisor)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("SV-14 verify permission does not allow a supervisor to close", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    await expect(
      serviceFor(prisma).closeWorkOrder("wo-1", "done", supervisor)
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-15 an authorized manager can still close a verified work order", async () => {
    const prisma = woPrisma();
    prisma.workOrder.findFirst.mockResolvedValue({
      ...completed,
      status: WorkOrderStatus.VERIFIED,
      requesterConfirmationStatus: "CONFIRMED"
    });
    prisma.workOrder.update.mockResolvedValue({ status: WorkOrderStatus.CLOSED });
    await serviceFor(prisma).closeWorkOrder("wo-1", "done", { ...supervisor, role: RoleName.MANAGER, sub: "manager-1" });
    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: WorkOrderStatus.CLOSED }) })
    );
  });

  it("SV-16 missing evidence blocks verification", async () => {
    process.env.STORAGE_UPLOADS_ENABLED = "true";
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    prisma.evidenceAttachment.findMany.mockResolvedValue([]);
    await expect(serviceFor(prisma).verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.workOrder.update).not.toHaveBeenCalled();
  });

  it("SV-17a verification without a version is rejected", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    await expect(serviceFor(prisma).verifySupervisor("wo-1", { verificationNote: "Checked" }, supervisor)).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(prisma.workOrder.updateMany).not.toHaveBeenCalled();
  });

  it("SV-17 a stale version does not overwrite the verifier", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    prisma.workOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      serviceFor(prisma).verifySupervisor("wo-1", { expectedVersion: 3 }, supervisor)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("SV-18 removing the permission blocks the next verification", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValueOnce(grant(["work_orders.verify"])).mockResolvedValueOnce(grant([]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    prisma.workOrder.updateMany.mockResolvedValue({ count: 1 });
    const service = serviceFor(prisma);
    await service.verifySupervisor("wo-1", { expectedVersion: 3 }, supervisor);
    await expect(service.verifySupervisor("wo-1", {}, supervisor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("SV-20 supervisor verify does not grant reject, cancel, or reopen", async () => {
    const prisma = woPrisma();
    prisma.user.findUnique.mockResolvedValue(grant(["work_orders.verify"]));
    prisma.workOrder.findFirst.mockResolvedValue(completed);
    const service = serviceFor(prisma);
    await expect(service.rejectSupervisor("wo-1", "Rework this", supervisor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateStatus("wo-1", { status: WorkOrderStatus.CANCELLED, cancelReason: "No longer required" }, supervisor)
    ).rejects.toThrow();
    await expect(service.reopenWorkOrder("wo-1", "Need it open", supervisor)).rejects.toBeInstanceOf(BadRequestException);
    const roles = new Reflector().get<string[]>(ROLES_KEY, WorkOrdersController.prototype.verifySupervisor);
    expect(roles).toContain("SUPERVISOR");
    const closeRoles = new Reflector().get<string[]>(ROLES_KEY, WorkOrdersController.prototype.closeWorkOrder);
    expect(closeRoles).not.toContain("SUPERVISOR");
  });
});

describe("approved verified stock availability", () => {
  const partId = "part-1";

  it("ST-01 stock 19 rejects issue 500", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient({ onHand: 19 }) as never, { tenantId: "t", partId, quantity: 500 })
    ).rejects.toThrow(insufficientVerifiedStockMessage(19, 500));
  });

  it("ST-02 stock 19 allows issue 10", async () => {
    const result = await assertVerifiedIssueAllowed(stockClient({ onHand: 19 }) as never, {
      tenantId: "t",
      partId,
      quantity: 10
    });
    expect(result.available).toBe(19);
  });

  it("ST-03 stock 0 rejects issue 1", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient({ onHand: 0 }) as never, { tenantId: "t", partId, quantity: 1 })
    ).rejects.toThrow(insufficientVerifiedStockMessage(0, 1));
  });

  it("ST-04 negative quantity is rejected", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient() as never, { tenantId: "t", partId, quantity: -1 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ST-05 zero quantity is rejected", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient() as never, { tenantId: "t", partId, quantity: 0 })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ST-06 fractional quantity is rejected", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient() as never, { tenantId: "t", partId, quantity: 1.5 })
    ).rejects.toThrow("whole number");
  });

  it("ST-07 reserved stock is excluded", async () => {
    await expect(
      assertVerifiedIssueAllowed(stockClient({ onHand: 19, reserved: 10 }) as never, { tenantId: "t", partId, quantity: 10 })
    ).rejects.toThrow(insufficientVerifiedStockMessage(9, 10));
  });

  it("ST-11 a warehouse without ERP provenance is rejected", async () => {
    await expect(
      assertVerifiedIssueAllowed(
        stockClient({ warehouse: { id: "wh-1", erpWarehouseCode: null, lastErpValidatedAt: null } }) as never,
        { tenantId: "t", partId, quantity: 1 }
      )
    ).rejects.toThrow("Missing ERP provenance");
  });

  it("ST-12 a missing snapshot is rejected", async () => {
    const client = stockClient();
    client.warehouseItemBalance.findFirst.mockResolvedValue(null);
    await expect(
      assertVerifiedIssueAllowed(client as never, { tenantId: "t", partId, quantity: 1 })
    ).rejects.toThrow("Missing verified ERP stock snapshot");
  });

  it("ST-16 another warehouse balance is not used", async () => {
    const client = stockClient({ warehouse: null });
    client.warehouse.findFirst.mockResolvedValue({
      id: "wh-b",
      erpWarehouseCode: null,
      lastErpValidatedAt: null,
      isActive: true
    });
    await expect(
      assertVerifiedIssueAllowed(client as never, { tenantId: "t", partId, quantity: 1, warehouseId: "wh-b" })
    ).rejects.toThrow("Missing ERP provenance");
  });

  it("ST-20 consumption already inside a later snapshot is not subtracted twice", () => {
    const sums = sumUnreconciledQuantities({
      partId,
      verifiedAt,
      events: [
        {
          eventType: "WORK_ORDER_PART_CONSUMPTION",
          payload: JSON.stringify({ partId, quantity: 10 }),
          createdAt: new Date("2026-09-01T00:00:00.000Z")
        }
      ]
    });
    expect(verifiedAvailableQuantity({ verifiedOnHand: 19, reserved: 0, unreconciledIssued: sums.issued, unreconciledReturned: sums.returned })).toBe(19);
  });

  it("ST-21 a validated return after the snapshot increases availability and a pending issue decreases it", () => {
    const sums = sumUnreconciledQuantities({
      partId,
      verifiedAt,
      events: [
        {
          eventType: "WORK_ORDER_PART_CONSUMPTION",
          payload: JSON.stringify({ partId, quantity: 4 }),
          createdAt: new Date("2026-10-02T00:00:00.000Z")
        },
        {
          eventType: "WORK_ORDER_PART_RETURN",
          payload: JSON.stringify({ partId, quantity: 1 }),
          createdAt: new Date("2026-10-03T00:00:00.000Z")
        }
      ]
    });
    expect(
      verifiedAvailableQuantity({
        verifiedOnHand: 19,
        reserved: 2,
        unreconciledIssued: sums.issued,
        unreconciledReturned: sums.returned
      })
    ).toBe(14);
  });

  it("ST-30 effective availability cannot go negative in the formula result used for rejection", async () => {
    const client = stockClient({
      onHand: 19,
      events: [
        {
          eventType: "WORK_ORDER_PART_CONSUMPTION",
          payload: JSON.stringify({ partId, quantity: 12 }),
          createdAt: new Date("2026-10-02T00:00:00.000Z")
        }
      ]
    });
    await expect(
      assertVerifiedIssueAllowed(client as never, { tenantId: "t", partId, quantity: 12 })
    ).rejects.toThrow(insufficientVerifiedStockMessage(7, 12));
  });
});
