import {
  assignedToActorScope,
  businessDayWindow,
  compareMyJobs,
  isMyJobEvidenceNeeded,
  isMyJobOverdue,
  isMyJobWaitingParts,
  matchesMyJobFilters,
  matchesMyJobView
} from "../src/modules/work-orders/my-jobs.rules";

describe("my jobs assignment and views", () => {
  const now = new Date("2026-09-29T08:00:00.000+05:30");

  it("scopes a manager to their own user id, not every assignee", () => {
    expect(assignedToActorScope("manager-1")).toEqual({
      OR: [
        { technicianId: "manager-1" },
        {
          assignees: {
            some: {
              assignmentStatus: { not: "REMOVED" },
              employee: { linkedUserId: "manager-1" }
            }
          }
        }
      ]
    });
  });

  it("keeps active, overdue, due today, in progress, and completed distinct", () => {
    const window = businessDayWindow(now);
    const overdue = { status: "ASSIGNED", dueDate: new Date(window.start.getTime() - 60_000), id: "1" };
    const today = { status: "ASSIGNED", dueDate: new Date(window.start.getTime() + 60_000), id: "2" };
    const undated = { status: "ASSIGNED", dueDate: null, id: "3" };
    const progress = { status: "IN_PROGRESS", dueDate: null, id: "4" };
    const closed = { status: "CLOSED", dueDate: new Date(window.start.getTime() - 86_400_000), id: "5" };

    expect(matchesMyJobView(overdue, "active", now)).toBe(true);
    expect(matchesMyJobView(overdue, "overdue", now)).toBe(true);
    expect(matchesMyJobView(today, "due-today", now)).toBe(true);
    expect(matchesMyJobView(today, "overdue", now)).toBe(false);
    expect(isMyJobOverdue(undated, now)).toBe(false);
    expect(matchesMyJobView(undated, "due-today", now)).toBe(false);
    expect(matchesMyJobView(progress, "in-progress", now)).toBe(true);
    expect(matchesMyJobView(closed, "completed", now)).toBe(true);
    expect(matchesMyJobView(closed, "overdue", now)).toBe(false);
    expect(matchesMyJobView(closed, "active", now)).toBe(false);
  });

  it("keeps waiting parts, evidence, and rework as separate assigned-job filters", () => {
    const waiting = {
      status: "IN_PROGRESS",
      parts: [{ lineStatus: "REQUESTED", pendingReturnQuantity: 0, issuedQuantity: 0, requestedQuantity: 1 }]
    };
    const issuedOnly = {
      status: "IN_PROGRESS",
      parts: [{ lineStatus: "ISSUED", pendingReturnQuantity: 0, issuedQuantity: 1, requestedQuantity: 1 }]
    };
    const rework = { status: "REWORK_REQUIRED", parts: [] };
    const rejectedEvidence = {
      status: "IN_PROGRESS",
      type: "CORRECTIVE",
      evidenceAttachments: [{ evidenceType: "BEFORE_PHOTO" as const, status: "UPLOADED", verificationStatus: "REJECTED" as const }]
    };

    expect(isMyJobWaitingParts(waiting)).toBe(true);
    expect(matchesMyJobView(waiting, "waiting-parts", now)).toBe(true);
    expect(matchesMyJobView(waiting, "due-today", now)).toBe(false);
    expect(isMyJobWaitingParts(issuedOnly)).toBe(false);
    expect(isMyJobWaitingParts({ status: "CLOSED", hasPartIssue: true })).toBe(false);
    expect(matchesMyJobView(rework, "rework-required", now)).toBe(true);
    expect(matchesMyJobView(rework, "active", now)).toBe(true);
    expect(isMyJobEvidenceNeeded(rejectedEvidence)).toBe(true);
    expect(matchesMyJobView(rejectedEvidence, "evidence-needed", now)).toBe(true);
    expect(matchesMyJobView({ status: "CLOSED", type: "CORRECTIVE", evidenceAttachments: rejectedEvidence.evidenceAttachments }, "evidence-needed", now)).toBe(false);
  });

  it("applies search and status before view counts", () => {
    const pump = { status: "ASSIGNED", priority: "HIGH", dueDate: null, woNumber: "WO-1", title: "Pump", assetName: "P-04" };
    const boiler = { status: "IN_PROGRESS", priority: "LOW", dueDate: null, woNumber: "WO-2", title: "Boiler", assetName: "B-01" };
    expect(matchesMyJobFilters(pump, { search: "p-04" }, now)).toBe(true);
    expect(matchesMyJobFilters(boiler, { search: "p-04" }, now)).toBe(false);
    expect(matchesMyJobFilters(boiler, { status: "IN_PROGRESS" }, now)).toBe(true);
    expect(matchesMyJobFilters(pump, { status: "IN_PROGRESS" }, now)).toBe(false);
  });

  it("sorts overdue first, then priority, then due date, then id", () => {
    const rows = [
      { id: "b", status: "ASSIGNED", priority: "LOW", dueDate: new Date("2026-10-02T00:00:00.000Z") },
      { id: "a", status: "ASSIGNED", priority: "CRITICAL", dueDate: new Date("2026-09-01T00:00:00.000Z") },
      { id: "c", status: "ASSIGNED", priority: "HIGH", dueDate: new Date("2026-09-01T00:00:00.000Z") }
    ];
    const sorted = [...rows].sort((left, right) => compareMyJobs(left, right, now));
    expect(sorted.map((row) => row.id)).toEqual(["a", "c", "b"]);
  });
});
