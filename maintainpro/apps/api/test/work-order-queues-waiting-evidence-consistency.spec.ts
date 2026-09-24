import { RoleName, WorkOrderStatus, WorkOrderType, EvidenceType } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

/**
 * Regression coverage for the "Waiting Evidence (2) badge vs 0 in the list" defect:
 * the badge counted work orders via a hand-written 3-type/status DB heuristic, while
 * the list's final membership check used the real governance rule
 * (resolveEvidenceStatus -> evaluateEvidenceRequirements), which also accounts for
 * STORAGE_UPLOADS_ENABLED / NODE_ENV (evidence is waived, not "missing", when local
 * upload storage is disabled outside production). The two definitions disagreed, so
 * the badge and list showed different numbers for the same tenant/role/filters even
 * though both were reading the same work orders.
 */
describe("WorkOrderQueuesService waiting-evidence badge/list consistency", () => {
  const actor = {
    sub: "user-1",
    email: "manager@maintainpro.local",
    role: RoleName.MANAGER,
    tenantId: "tenant-1"
  };

  function baseRow(overrides: Record<string, unknown>) {
    return {
      id: "wo-base",
      tenantId: "tenant-1",
      woNumber: "WO-0000",
      title: "Base work order",
      type: WorkOrderType.CORRECTIVE,
      status: WorkOrderStatus.IN_PROGRESS,
      approvalStatus: "APPROVED",
      verificationStatus: "",
      isTriage: false,
      qrVerificationStatus: "NOT_REQUIRED",
      slaBreached: false,
      dueDate: null,
      priority: "MEDIUM",
      technicianId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      taxonomyCategoryId: null,
      categoryNameSnapshot: null,
      asset: null,
      vehicle: null,
      technician: null,
      createdBy: null,
      parts: [],
      partIssues: [],
      assignees: [],
      evidenceAttachments: [],
      vendorRepairCase: null,
      ...overrides
    };
  }

  function matchesWhere(row: Record<string, unknown>, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    const clause = where as Record<string, unknown>;
    if (Array.isArray(clause.AND) && !clause.AND.every((sub) => matchesWhere(row, sub))) return false;
    if (Array.isArray(clause.OR) && !clause.OR.some((sub) => matchesWhere(row, sub))) return false;
    for (const [field, condition] of Object.entries(clause)) {
      if (field === "AND" || field === "OR") continue;
      const value = row[field];
      if (condition && typeof condition === "object" && !Array.isArray(condition)) {
        const cond = condition as Record<string, unknown>;
        if ("notIn" in cond && Array.isArray(cond.notIn)) {
          if (cond.notIn.includes(value)) return false;
          continue;
        }
        continue; // other operators unused by the plain "nonTerminal" where this file exercises
      }
      if (value !== condition) return false;
    }
    return true;
  }

  function buildService(rows: ReturnType<typeof baseRow>[]) {
    const prisma = {
      workOrder: {
        count: jest.fn(async () => rows.length),
        findMany: jest.fn(async ({ where }: { where: unknown }) =>
          rows.filter((row) => matchesWhere(row, where))
        )
      }
    };
    const maintenanceReports = { computeWorkOrderRiskFactors: jest.fn().mockResolvedValue({}) };
    const categoryReports = { getCategorySummary: jest.fn() };
    const service = new WorkOrderQueuesService(
      prisma as never,
      maintenanceReports as never,
      categoryReports as never
    );
    return { service };
  }

  const originalStorage = process.env.STORAGE_UPLOADS_ENABLED;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalStorage === undefined) delete process.env.STORAGE_UPLOADS_ENABLED;
    else process.env.STORAGE_UPLOADS_ENABLED = originalStorage;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("badge and list agree: a CORRECTIVE job with no evidence is Missing when upload storage is enabled", async () => {
    process.env.STORAGE_UPLOADS_ENABLED = "true";
    process.env.NODE_ENV = "test";

    const rows = [
      baseRow({ id: "wo-missing", woNumber: "WO-1001", type: WorkOrderType.CORRECTIVE, evidenceAttachments: [] }),
      baseRow({
        id: "wo-complete",
        woNumber: "WO-1002",
        type: WorkOrderType.CORRECTIVE,
        evidenceAttachments: [
          { evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED", verificationStatus: null },
          { evidenceType: EvidenceType.AFTER_PHOTO, status: "UPLOADED", verificationStatus: null }
        ]
      })
    ];

    const { service } = buildService(rows);

    const badgeSummary = await service.getQueueSummary(actor);
    const badgeCount = badgeSummary.queues.find((q) => q.key === "waiting-evidence")?.count;

    const list = await service.getQueue(actor, "waiting-evidence", {});

    expect(badgeCount).toBe(1);
    expect(list.total).toBe(1);
    expect(list.data.map((item: { id: string }) => item.id)).toEqual(["wo-missing"]);
  });

  it("badge and list agree: evidence is waived (not Missing) when upload storage is disabled outside production", async () => {
    process.env.STORAGE_UPLOADS_ENABLED = "false";
    process.env.NODE_ENV = "development";

    const rows = [
      baseRow({ id: "wo-waived", woNumber: "WO-2001", type: WorkOrderType.CORRECTIVE, evidenceAttachments: [] })
    ];

    const { service } = buildService(rows);

    const badgeSummary = await service.getQueueSummary(actor);
    const badgeCount = badgeSummary.queues.find((q) => q.key === "waiting-evidence")?.count;
    const list = await service.getQueue(actor, "waiting-evidence", {});

    expect(badgeCount).toBe(0);
    expect(list.total).toBe(0);
  });
});
