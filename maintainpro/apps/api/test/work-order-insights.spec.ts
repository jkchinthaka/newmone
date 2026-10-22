import { NotFoundException } from "@nestjs/common";

import { WorkOrderInsightsService } from "../src/modules/work-orders/work-order-insights.service";
import { colomboDate, workOrderCost, workOrderSla, worseSla, assignmentLoadLabel } from "../src/modules/work-orders/work-order-insights";

describe("work order insights", () => {
  const created = colomboDate("2026-10-22T09:00:00");

  it("marks respond and resolve from Colombo wall time and the priority rule", () => {
    const rules = [{ priority: "HIGH", responseMinutes: 60, completionMinutes: 240 }];
    const early = workOrderSla({
      priority: "HIGH",
      createdAt: created,
      now: colomboDate("2026-10-22T09:20:00"),
      rules
    });
    expect(early.respond).toBe("On track");
    expect(early.resolve).toBe("On track");

    const atRisk = workOrderSla({
      priority: "HIGH",
      createdAt: created,
      now: colomboDate("2026-10-22T09:50:00"),
      rules
    });
    expect(atRisk.respond).toBe("At risk");

    const breached = workOrderSla({
      priority: "HIGH",
      createdAt: created,
      now: colomboDate("2026-10-22T10:05:00"),
      rules
    });
    expect(breached.respond).toBe("Breached");

    const startedLate = workOrderSla({
      priority: "HIGH",
      createdAt: created,
      startedAt: colomboDate("2026-10-22T10:30:00"),
      completedAt: colomboDate("2026-10-22T12:00:00"),
      now: colomboDate("2026-10-22T13:00:00"),
      rules
    });
    expect(startedLate.respond).toBe("Breached");
    expect(startedLate.resolve).toBe("On track");
    expect(worseSla(startedLate.respond, startedLate.resolve)).toBe("Breached");
  });

  it("leaves a cost line blank when an input is missing and sums the lines that are present", () => {
    const cost = workOrderCost({
      labour: [{ minutes: 60, rate: 1500 }, { minutes: 30, rate: null }],
      parts: [{ quantity: 2, unitCost: 400 }],
      vendorTotals: []
    });
    expect(cost.labour).toBeNull();
    expect(cost.parts).toBe(800);
    expect(cost.vendor).toBeNull();
    expect(cost.total).toBe(800);
  });

  it("labels three or more open jobs as busy", () => {
    expect(assignmentLoadLabel(0)).toBe("Available · 0 jobs");
    expect(assignmentLoadLabel(1)).toBe("Available · 1 job");
    expect(assignmentLoadLabel(3)).toBe("Busy · 3 jobs");
  });

  it("looks up insights only inside the caller's tenant", async () => {
    const prisma = { workOrder: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new WorkOrderInsightsService(prisma as never);
    await expect(service.forWorkOrder("tenant-b", "wo-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "wo-1", tenantId: "tenant-b" } })
    );
  });
});
