import { RoleName, WorkOrderStatus, WorkOrderApprovalStatus } from "@prisma/client";

import { WorkOrderQueuesService } from "../src/modules/work-orders/work-order-queues.service";

/**
 * Regression coverage for the "Action Required (6) badge vs 1 total in the list"
 * defect: the list's DB candidate-fetch predicate for the action-required queue only
 * checked status === OVERDUE, while the badge's count predicate also matched work
 * orders whose dueDate was in the past but whose status had not been transitioned to
 * OVERDUE. Those rows were counted in the badge but silently dropped before the list's
 * enrichment/filter step ever ran, so the badge, list total, and category summary
 * disagreed even though they read the same underlying data under the same tenant,
 * role, and filters.
 */
describe("WorkOrderQueuesService action-required badge/list consistency", () => {
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
      type: "CORRECTIVE",
      status: WorkOrderStatus.OPEN,
      approvalStatus: WorkOrderApprovalStatus.APPROVED,
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

  /**
   * Minimal Prisma `where`-clause evaluator, just enough to faithfully exercise
   * applyQueueDbWhere's actual predicate shape (AND/OR, notIn, lt, gt, relation
   * `some`) against the in-memory fixture rows below. Without this, a `findMany`
   * mock that ignores `where` entirely would pass regardless of whether the
   * production predicate is correct — which is exactly the bug this file guards.
   */
  function matchesWhere(row: Record<string, unknown>, where: unknown): boolean {
    if (!where || typeof where !== "object") return true;
    const clause = where as Record<string, unknown>;

    if (Array.isArray(clause.AND)) {
      if (!clause.AND.every((sub) => matchesWhere(row, sub))) return false;
    }
    if (Array.isArray(clause.OR)) {
      if (!clause.OR.some((sub) => matchesWhere(row, sub))) return false;
    }

    for (const [field, condition] of Object.entries(clause)) {
      if (field === "AND" || field === "OR") continue;
      const value = row[field];

      if (condition && typeof condition === "object" && !Array.isArray(condition)) {
        const cond = condition as Record<string, unknown>;
        if ("notIn" in cond && Array.isArray(cond.notIn)) {
          if (cond.notIn.includes(value)) return false;
          continue;
        }
        if ("in" in cond && Array.isArray(cond.in)) {
          if (!cond.in.includes(value)) return false;
          continue;
        }
        if ("lt" in cond) {
          const dueDate = value as Date | null;
          if (!(dueDate instanceof Date) || !(dueDate.getTime() < (cond.lt as Date).getTime())) return false;
          continue;
        }
        if ("gt" in cond) {
          if (!((value as number) > (cond.gt as number))) return false;
          continue;
        }
        if ("some" in cond) {
          const items = Array.isArray(value) ? value : [];
          if (!items.some((item: Record<string, unknown>) => matchesWhere(item, cond.some))) return false;
          continue;
        }
        // Nested relation object (e.g. vendorRepairCase: { invoices: { some: {...} } }).
        if (!matchesWhere((value as Record<string, unknown>) ?? {}, cond)) return false;
        continue;
      }

      if (value !== condition) return false;
    }
    return true;
  }

  function buildService(rows: ReturnType<typeof baseRow>[]) {
    const rowsById = new Map(rows.map((row) => [row.id as string, row]));
    const prisma = {
      workOrder: {
        count: jest.fn(async ({ where }: { where: unknown }) =>
          rows.filter((row) => matchesWhere(row, where)).length
        ),
        findMany: jest.fn(async ({ where }: { where: unknown }) =>
          rows.filter((row) => matchesWhere(row, where))
        )
      }
    };
    const maintenanceReports = {
      // Mirrors MaintenanceReportsService.computeWorkOrderRiskFactors: in production
      // this is a real, independent overdue check (this.isOverdue(wo)) derived from the
      // work order's own dueDate/status, not something enrichRow derives locally.
      computeWorkOrderRiskFactors: jest.fn(async (workOrderId: string) => {
        const row = rowsById.get(workOrderId);
        const dueDate = row?.dueDate as Date | null | undefined;
        const status = row?.status as WorkOrderStatus | undefined;
        const overdue =
          status === WorkOrderStatus.OVERDUE || Boolean(dueDate && dueDate.getTime() < Date.now());
        return { overdue };
      })
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

  it("includes work orders overdue by dueDate alone (status never transitioned to OVERDUE) in the action-required list", async () => {
    const now = new Date();
    const pastDue = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const rows = [
      // Matches via approvalStatus PENDING (was always present in both predicates).
      baseRow({
        id: "wo-approval-pending",
        woNumber: "WO-0006",
        approvalStatus: WorkOrderApprovalStatus.PENDING
      }),
      // Matches ONLY via dueDate < now while status is still ASSIGNED/OPEN — this is
      // exactly the class of row that was previously dropped from the list.
      baseRow({
        id: "wo-overdue-by-date-1",
        woNumber: "WO-0008",
        status: WorkOrderStatus.ASSIGNED,
        dueDate: pastDue
      }),
      baseRow({
        id: "wo-overdue-by-date-2",
        woNumber: "WO-0144",
        status: WorkOrderStatus.OPEN,
        dueDate: pastDue
      }),
      // A genuinely unrelated, non-action-required row that must NOT appear.
      baseRow({
        id: "wo-clean",
        woNumber: "WO-9999",
        status: WorkOrderStatus.OPEN,
        dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      })
    ];

    const { service } = buildService(rows);
    const result = await service.getQueue(actor, "action-required", {});

    const returnedIds = result.data.map((item: { id: string }) => item.id).sort();
    expect(returnedIds).toEqual(
      ["wo-approval-pending", "wo-overdue-by-date-1", "wo-overdue-by-date-2"].sort()
    );
    expect(result.total).toBe(3);

    const categorySummaryTotal = (result.categorySummary ?? []).reduce(
      (sum: number, bucket: { total: number }) => sum + bucket.total,
      0
    );
    expect(categorySummaryTotal).toBe(result.total);
  });

  it("does not include a clean, on-time, approved work order in the action-required list", async () => {
    const rows = [
      baseRow({
        id: "wo-clean-2",
        woNumber: "WO-1000",
        status: WorkOrderStatus.IN_PROGRESS,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      })
    ];

    const { service } = buildService(rows);
    const result = await service.getQueue(actor, "action-required", {});

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
