import { Priority } from "@prisma/client";

import { MaintenanceConfigService } from "../src/modules/maintenance-config/maintenance-config.service";

describe("maintenance config SLA resolution", () => {
  const tenantId = "tenant-a";

  function buildService(findFirst: jest.Mock) {
    const prisma = {
      prioritySlaRule: { findFirst },
      configChangeHistory: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0)
      }
    } as never;
    return new MaintenanceConfigService(prisma);
  }

  it("uses Admin PrioritySlaRule completionMinutes when active", async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: "rule-1",
      tenantId,
      priority: "CRITICAL",
      completionMinutes: 30,
      responseMinutes: 15,
      active: true
    });
    const service = buildService(findFirst);

    await expect(service.resolveCompletionHours(tenantId, Priority.CRITICAL)).resolves.toBe(0.5);
    expect(findFirst).toHaveBeenCalledWith({
      where: { tenantId, priority: "CRITICAL", active: true }
    });
  });

  it("falls back to software defaults when no active rule", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = buildService(findFirst);

    await expect(service.resolveCompletionHours(tenantId, Priority.CRITICAL)).resolves.toBe(4);
    await expect(service.resolveCompletionHours(tenantId, Priority.HIGH)).resolves.toBe(24);
    await expect(service.resolveCompletionHours(tenantId, Priority.MEDIUM)).resolves.toBe(72);
    await expect(service.resolveCompletionHours(tenantId, Priority.LOW)).resolves.toBe(168);
  });

  it("records config history on PrioritySlaRule upsert", async () => {
    const createHistory = jest.fn().mockResolvedValue({});
    const countHistory = jest.fn().mockResolvedValue(1);
    const upsert = jest.fn().mockResolvedValue({
      id: "rule-critical",
      tenantId,
      priority: "CRITICAL",
      completionMinutes: 45,
      responseMinutes: 20,
      escalateOnBreach: true,
      notifyOnBreach: true,
      active: true
    });
    const prisma = {
      prioritySlaRule: {
        findUnique: jest.fn().mockResolvedValue({
          id: "rule-critical",
          tenantId,
          priority: "CRITICAL",
          completionMinutes: 240,
          responseMinutes: 30,
          active: true
        }),
        upsert
      },
      configChangeHistory: {
        create: createHistory,
        count: countHistory
      }
    } as never;
    const service = new MaintenanceConfigService(prisma);

    const saved = await service.upsertPrioritySla(
      { sub: "admin-1", tenantId, role: "ADMIN" },
      {
        priority: "CRITICAL",
        completionMinutes: 45,
        responseMinutes: 20,
        reason: "Cold room emergency SLA"
      }
    );

    expect(saved.completionMinutes).toBe(45);
    expect(createHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          entityType: "PrioritySlaRule",
          entityId: "rule-critical",
          action: "UPDATE",
          reason: "Cold room emergency SLA",
          actorId: "admin-1",
          version: 2
        })
      })
    );
  });

  it("enforces hold notes from Admin MaintenanceReasonCode", async () => {
    const service = new MaintenanceConfigService({
      maintenanceReasonCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: "hold-1",
          code: "OTHER",
          requiresNotes: true,
          active: true
        })
      }
    } as never);

    await expect(service.assertHoldReason(tenantId, "OTHER", "  ")).rejects.toThrow(
      /Hold notes are required/i
    );
    await expect(service.assertHoldReason(tenantId, "OTHER", "Waiting on access")).resolves.toBeUndefined();
  });
});
