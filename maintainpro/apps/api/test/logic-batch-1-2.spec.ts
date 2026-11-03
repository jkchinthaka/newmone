import { readFileSync } from "node:fs";
import { join } from "node:path";

import { initialPmNextDueAt, pmBaselineAfterClose } from "../src/modules/planning/pm-baseline";

const read = (relative: string) => readFileSync(join(__dirname, "..", relative), "utf8");
const service = read("src/modules/work-orders/work-orders.service.ts");
const assignees = read("src/modules/work-orders/work-order-assignees.service.ts");
const parts = read("src/modules/work-orders/work-order-parts.service.ts");
const approvals = read("src/modules/approvals/approvals.service.ts");
const planning = read("src/modules/planning/planning.service.ts");

describe("PM plan baseline", () => {
  const calendar90 = [{ kind: "CALENDAR", intervalDays: 90 }];
  const meter500 = [{ kind: "METER", intervalValue: 500 }];

  it("a new calendar plan is first due one interval after it takes effect", () => {
    expect(initialPmNextDueAt(new Date("2026-10-01T00:00:00Z"), calendar90)?.toISOString()).toBe("2026-12-30T00:00:00.000Z");
    expect(initialPmNextDueAt(new Date("2026-10-01T00:00:00Z"), meter500)).toBeNull();
    expect(planning).toMatch(/nextDueAt: initialPmNextDueAt\(input\.effectiveFrom \?\? new Date\(\), input\.triggers\)/);
  });

  it("closing a calendar PM moves the due date forward from the close", () => {
    const patch = pmBaselineAfterClose({ closedAt: new Date("2026-10-22T00:00:00Z"), triggers: calendar90, isVehicle: false });
    expect(patch.nextDueAt?.toISOString()).toBe("2027-01-20T00:00:00.000Z");
  });

  it("closing a meter PM moves the threshold from the completion reading", () => {
    expect(
      pmBaselineAfterClose({ closedAt: new Date(), triggers: meter500, completionReading: 10_050, isVehicle: true })
    ).toMatchObject({ lastCompletionMileage: 10_050, nextDueMeterValue: 10_550 });
    expect(
      pmBaselineAfterClose({ closedAt: new Date(), triggers: meter500, completionReading: 1_200, isVehicle: false })
    ).toMatchObject({ lastCompletionHours: 1_200, nextDueMeterValue: 1_700 });
  });

  it("without a reading the threshold still moves one interval, so the same reading cannot fire again", () => {
    expect(
      pmBaselineAfterClose({ closedAt: new Date(), triggers: meter500, completionReading: null, isVehicle: true, previousThreshold: 10_000 })
    ).toMatchObject({ nextDueMeterValue: 10_500 });
    expect(service).toMatch(/data: pmBaselineAfterClose\(\{/);
  });
});

describe("work order flow wiring", () => {
  it("hold, completion and cancel close every open labour session on the job", () => {
    expect(service).not.toMatch(/closeActiveLabourSessions\(id, actor\?\.sub/);
    expect(service).toMatch(/assertReasonProvided\("Cancel reason", data\.cancelReason\);\s*\/\/[^\n]*\n\s*await this\.closeActiveLabourSessions\(id, undefined, tenantId\);/);
    expect(assignees).toMatch(/technicianUserId: removedUserId, endedAt: null/);
  });

  it("approving or rejecting a job settles its open approval request", () => {
    expect(service).toMatch(/decision: ApprovalDecisionOutcome\.APPROVED/);
    expect(service).toMatch(/decision: ApprovalDecisionOutcome\.REJECTED/);
    expect(approvals).toMatch(/decision\.finalStatus === ApprovalRequestStatus\.REJECTED && request\.subjectEntityType === "WorkOrder"/);
  });

  it("reassignment and removal take the job off the previous technician", () => {
    expect(service).toMatch(/if \(isReassignment && current\.technicianId\)/);
    expect(assignees).toMatch(/if \(assignee\.isPrimary \|\| removedIsLinkedTechnician\)/);
    expect(service).toMatch(/await this\.promoteAssignedTechnician\(workOrderId, actor\);/);
  });

  it("each hold gets its own start time and rework clears the old completion date", () => {
    expect(service).toMatch(/targetStatus === WorkOrderStatus\.ON_HOLD \? new Date\(\) : current\.heldAt/);
    expect(service).toMatch(/completedDate: null,\s*repairCompletedAt: null,/);
  });
});

describe("parts", () => {
  it("scrap returns are counted once, as damaged", () => {
    expect(parts).toMatch(/const nextReturned = isDamagedReturn \? line\.returnedQuantity : line\.returnedQuantity \+ data\.confirmedQuantity;/);
  });

  it("a job with returns waiting for stores cannot be closed", () => {
    expect(parts).toMatch(/pendingReturnLines: lines\.filter/);
    expect(service).toMatch(/Stores must confirm the pending part returns before this work order is closed\./);
  });
});
