import { RoleName, WorkOrderStatus } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

describe("WorkOrderQueuesService lightweight summary", () => {
  const actor = {
    sub: "user-1",
    email: "admin@maintainpro.local",
    role: RoleName.ADMIN,
    tenantId: "tenant-1"
  };

  function buildService(countImpl: (args: { where: unknown }) => number | Promise<number> = () => 0) {
    const prisma = {
      workOrder: {
        count: jest.fn(async (args: { where: unknown }) => countImpl(args)),
        // countWaitingEvidence() counts via findMany + resolveEvidenceStatus rather
        // than a plain DB where (see work-order-queues.service.ts for why); an empty
        // fixture DB has nothing waiting on evidence either way.
        findMany: jest.fn().mockResolvedValue([])
      }
    };
    const maintenanceReports = {
      computeWorkOrderRiskFactors: jest.fn().mockResolvedValue({})
    };
    const categoryReports = {
      getCategorySummary: jest.fn()
    };
    const service = new WorkOrderQueuesService(
      prisma as never,
      maintenanceReports as never,
      categoryReports as never
    );
    return { service, prisma };
  }

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  it("returns 200-shaped summary with zero counts for empty DB", async () => {
    const { service, prisma } = buildService();
    const summary = await service.getQueueSummary(actor);

    expect(prisma.workOrder.count).toHaveBeenCalled();
    expect(summary.queues.length).toBeGreaterThan(0);
    expect(summary.queues.every((queue) => queue.count === 0)).toBe(true);
    expect(summary.defaultQueue).toBe("action-required");
    expect(summary.summary.actionRequired).toBe(0);
    expect(summary.lastUpdated).toBeTruthy();
  });

  it("applies tenant scope to every count query", async () => {
    const { service, prisma } = buildService();
    await service.getQueueSummary(actor);

    const serializedCalls = JSON.stringify(prisma.workOrder.count.mock.calls);
    expect(serializedCalls).toContain('"tenantId":"tenant-1"');
  });

  it("returns open count for legacy work orders without taxonomy", async () => {
    const { service } = buildService(({ where }) => {
      const serialized = JSON.stringify(where);
      if (serialized.includes(`"status":"${WorkOrderStatus.OPEN}"`)) return 1;
      return 0;
    });

    const summary = await service.getQueueSummary(actor);
    expect(summary.queues.find((queue) => queue.key === "open-requests")?.count).toBe(1);
  });

  it("uses database counts beyond the first 25 rows instead of deriving aggregates from page one", async () => {
    const { service, prisma } = buildService(({ where }) => {
      const serialized = JSON.stringify(where);
      return serialized.includes(`"status":"${WorkOrderStatus.OPEN}"`) && !serialized.includes("approvalStatus")
        ? 31
        : 0;
    });

    const summary = await service.getQueueSummary(actor);

    expect(summary.queues.find((queue) => queue.key === "open-requests")?.count).toBe(31);
    expect(prisma.workOrder.count).toHaveBeenCalled();
    // countWaitingEvidence() legitimately calls findMany (see work-order-queues.service.ts
    // for why "waiting evidence" can't be a plain DB where) — that's not the page-one
    // aggregation bug this test guards against. What matters is that no queue count,
    // including open-requests, is derived by fetching a *paginated page* (take/skip)
    // and counting client-side.
    const findManyCalls = (prisma.workOrder as { findMany: jest.Mock }).findMany.mock.calls;
    for (const [args] of findManyCalls) {
      expect(args).not.toHaveProperty("skip");
      expect(args.take).not.toBe(25);
    }
  });

  it("returns 200 when dueDate is null and overdue query is evaluated", async () => {
    const { service } = buildService(({ where }) => {
      const serialized = JSON.stringify(where);
      if (serialized.includes("dueDate")) return 0;
      return 0;
    });

    const summary = await service.getQueueSummary(actor);
    expect(summary.summary.overdue).toBe(0);
    expect(summary.warnings ?? []).toHaveLength(0);
  });

  it("returns 200 with warning when one queue count fails", async () => {
    const { service } = buildService(({ where }) => {
      const serialized = JSON.stringify(where);
      if (serialized.includes("IN_PROGRESS")) {
        return Promise.reject(new Error("count failed"));
      }
      return 0;
    });

    const summary = await service.getQueueSummary(actor);
    expect(summary.queues.find((queue) => queue.key === "in-progress")?.count).toBe(0);
    expect(summary.warnings?.some((warning) => warning.queue === "in-progress")).toBe(true);
  });

  it("returns timeout fallback without throwing", async () => {
    const previousEndpointTimeout = process.env.WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS;
    const previousCountTimeout = process.env.WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS;
    process.env.WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS = "50";
    process.env.WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS = "200";

    const { service } = buildService(() => new Promise(() => undefined));

    const summary = await service.getQueueSummary(actor);
    expect(summary.summary.actionRequired).toBe(0);
    expect(summary.warnings?.some((warning) => warning.queue === "all")).toBe(true);

    // The endpoint fallback returns before the deliberately unresolved count
    // operations finish their own bounded timers. Let those timers drain while
    // the short test configuration is still active so Jest has no open handles.
    await new Promise((resolve) => setTimeout(resolve, 450));

    restoreEnv("WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS", previousEndpointTimeout);
    restoreEnv("WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS", previousCountTimeout);
  });

  it("uses safe defaults for malformed timeout configuration", async () => {
    const previousEndpointTimeout = process.env.WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS;
    const previousCountTimeout = process.env.WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS;
    process.env.WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS = "undefined";
    process.env.WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS = "not-a-number";

    const { service } = buildService();
    const summary = await service.getQueueSummary(actor);

    expect(summary.warnings ?? []).toHaveLength(0);
    restoreEnv("WORK_ORDER_QUEUE_SUMMARY_ENDPOINT_TIMEOUT_MS", previousEndpointTimeout);
    restoreEnv("WORK_ORDER_QUEUE_COUNT_TIMEOUT_MS", previousCountTimeout);
  });

  it("exposes lightweight diagnostics marker", () => {
    const { service } = buildService();
    expect(service.getQueueDiagnostics().implementation).toBe("queues-lightweight-v2");
  });

  it("scopes technician actor to assigned work orders", async () => {
    const technician = { ...actor, sub: "tech-1", role: RoleName.TECHNICIAN };
    const { service, prisma } = buildService();
    await service.getQueueSummary(technician);

    const serialized = JSON.stringify(prisma.workOrder.count.mock.calls);
    expect(serialized).toContain("tech-1");
    expect(prisma.workOrder.count.mock.calls.some((call) => !JSON.stringify(call[0].where).includes('"all"'))).toBe(true);
  });
});
