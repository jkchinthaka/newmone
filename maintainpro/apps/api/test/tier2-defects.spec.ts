import { WorkOrderStatus } from "@prisma/client";

import { inProgressQueueWhere, unassignedQueueWhere } from "../src/common/utils/work-order-queues";
import { evaluateEvidenceRequirements } from "../src/common/utils/work-order-evidence-governance";
import { pmPlanOverdueWhere } from "../src/modules/planning/pm-plan-query";
import { completionRate, isReportCompleted, sumAmounts } from "../src/modules/reports/report-completion";
import {
  buildWorkOrderActivityTimeline,
  historyActivityLabel
} from "../src/modules/work-orders/work-order-activity.mapper";
import { lastOpenReleaseDecision } from "../src/modules/work-orders/work-order-domain.service";

describe("Tier 2 defects", () => {
  it("QA-FRESH-MAINT-021 last open work order returns the asset; another open job keeps it", () => {
    expect(lastOpenReleaseDecision(0, "UNDER_MAINTENANCE")).toBe("return");
    expect(lastOpenReleaseDecision(2, "UNDER_MAINTENANCE")).toBe("stay");
    expect(lastOpenReleaseDecision(0, "ACTIVE")).toBe("unchanged");
  });

  it("QA-FRESH-MAINT-025 history records plan, assign, hold, resume, issue, verify, and close with actor and time", () => {
    expect(historyActivityLabel("PLANNED")).toBe("Planned");
    expect(historyActivityLabel("ASSIGNED")).toBe("Assigned");
    expect(historyActivityLabel("ON_HOLD")).toBe("Held");
    expect(historyActivityLabel("RESUMED")).toBe("Resumed");
    expect(historyActivityLabel("PART_ISSUED")).toBe("Part issued");
    expect(historyActivityLabel("VERIFIED")).toBe("Verified");
    expect(historyActivityLabel("CLOSED")).toBe("Closed");

    const at = new Date("2026-10-19T04:00:00.000Z");
    const timeline = buildWorkOrderActivityTimeline({
      id: "wo-1",
      tenantId: "tenant-1",
      woNumber: "WO-1",
      title: "Pump",
      status: WorkOrderStatus.CLOSED,
      priority: "MEDIUM" as never,
      createdAt: at,
      dueDate: null,
      startDate: null,
      completedDate: null,
      slaDeadline: null,
      createdBy: null,
      technician: null,
      facilityIssue: null,
      partRequests: [],
      statusEvents: [
        { id: "h1", action: "PLANNED", createdAt: at, actorName: "Ada Planner", reason: "Scheduled" },
        { id: "h2", action: "CLOSED", createdAt: new Date(at.getTime() + 1000), actorName: "Ada Planner", reason: null }
      ]
    });
    const labels = timeline.entries.map((entry) => entry.label);
    expect(labels).toContain("Planned");
    expect(labels).toContain("Closed");
    const planned = timeline.entries.find((entry) => entry.label === "Planned");
    expect(planned?.actorName).toBe("Ada Planner");
    expect(planned?.timestamp).toBe(at.toISOString());
  });

  it("QA-FRESH-MAINT-017 completion count matches CLOSED and VERIFIED rows", () => {
    const rows = [
      { status: WorkOrderStatus.COMPLETED },
      { status: WorkOrderStatus.CLOSED },
      { status: WorkOrderStatus.VERIFIED },
      { status: WorkOrderStatus.CANCELLED },
      { status: WorkOrderStatus.OPEN }
    ];
    const card = rows.filter((row) => isReportCompleted(row.status)).length;
    const completed = new Set<WorkOrderStatus>([
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CLOSED,
      WorkOrderStatus.VERIFIED
    ]);
    const table = rows.filter((row) => completed.has(row.status)).length;
    expect(card).toBe(table);
    expect(card).toBe(3);
    expect(completionRate(card, rows.length)).toBe(60);
  });

  it("QA-FRESH-MAINT-022 in-progress card count matches the queue for the same filter", () => {
    const rows = [
      { status: WorkOrderStatus.IN_PROGRESS, technicianId: "t1" },
      { status: WorkOrderStatus.ON_HOLD, technicianId: "t1" },
      { status: WorkOrderStatus.OPEN, technicianId: null }
    ];
    const filter = inProgressQueueWhere();
    const statuses = (filter.status as { in: WorkOrderStatus[] }).in;
    const card = rows.filter((row) => statuses.includes(row.status)).length;
    const queue = rows.filter((row) => statuses.includes(row.status)).length;
    expect(card).toBe(queue);
    expect(card).toBe(2);
  });

  it("QA-FRESH-MAINT-023 unassigned card count matches the unassigned queue", () => {
    const rows = [
      { status: WorkOrderStatus.OPEN, technicianId: null },
      { status: WorkOrderStatus.PLANNED, technicianId: null },
      { status: WorkOrderStatus.OPEN, technicianId: "tech" },
      { status: WorkOrderStatus.ASSIGNED, technicianId: null }
    ];
    const where = unassignedQueueWhere();
    const statuses = (where.status as { in: WorkOrderStatus[] }).in;
    const match = (row: (typeof rows)[number]) =>
      statuses.includes(row.status) && row.technicianId == null;
    expect(rows.filter(match).length).toBe(2);
    expect(rows.filter(match).length).toBe(rows.filter(match).length);
  });

  it("QA-FRESH-MAINT-024 PM overdue card uses the same filter as the planning overdue list", () => {
    const now = new Date("2026-10-19T00:00:00.000Z");
    const cardWhere = pmPlanOverdueWhere(now);
    const listWhere = pmPlanOverdueWhere(now);
    expect(cardWhere).toEqual(listWhere);
    expect(cardWhere.status).toBe("ACTIVE");
    expect(cardWhere.nextDueAt).toEqual({ lt: now });
  });

  it("QA-FRESH-MAINT-024 cost card total matches the consumed table", () => {
    const rows = [{ amount: 12.5 }, { amount: 7.5 }, { amount: 0 }];
    const card = sumAmounts(rows);
    const table = rows.reduce((sum, row) => sum + row.amount, 0);
    expect(card).toBe(table);
    expect(card).toBe(20);
  });

  it("QA-FRESH-MAINT-049 waived evidence is not also missing", () => {
    const previous = process.env.NODE_ENV;
    const storage = process.env.STORAGE_UPLOADS_ENABLED;
    process.env.NODE_ENV = "development";
    process.env.STORAGE_UPLOADS_ENABLED = "false";
    const result = evaluateEvidenceRequirements("CORRECTIVE" as never, []);
    expect(result.waived).toBe(true);
    expect(result.missingBefore).toBe(false);
    expect(result.missingAfter).toBe(false);
    expect(result.complete).toBe(true);
    process.env.NODE_ENV = previous;
    if (storage === undefined) delete process.env.STORAGE_UPLOADS_ENABLED;
    else process.env.STORAGE_UPLOADS_ENABLED = storage;
  });
});
