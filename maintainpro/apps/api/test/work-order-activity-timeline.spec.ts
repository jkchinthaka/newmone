import { NotFoundException } from "@nestjs/common";
import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity,
  Priority,
  RoleName,
  WorkOrderStatus
} from "@prisma/client";

import { WorkOrderActivityService } from "../src/modules/work-orders/work-order-activity.service";
import {
  buildWorkOrderActivityTimeline,
  publicLinkedFacilityIssueSummaryHasSensitiveFields,
  publicWorkOrderActivityEntryHasRawRelations,
  publicWorkOrderActivityEntryHasSensitiveFields,
  publicWorkOrderActivityTimelineHasSensitiveFields,
  sortWorkOrderActivityEntries
} from "../src/modules/work-orders/work-order-activity.mapper";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const WORK_ORDER_ID = "wo-1";
const ISSUE_ID = "issue-1";

const createPrismaMock = () => ({
  workOrder: {
    findFirst: jest.fn()
  }
});

const baseWorkOrderRecord = {
  id: WORK_ORDER_ID,
  tenantId: TENANT_A,
  woNumber: "WO-2026-0001",
  title: "Fix restroom leak",
  status: WorkOrderStatus.IN_PROGRESS,
  priority: Priority.HIGH,
  createdAt: new Date("2026-06-10T08:00:00.000Z"),
  dueDate: new Date("2026-06-12T17:00:00.000Z"),
  startDate: new Date("2026-06-10T09:00:00.000Z"),
  completedDate: null,
  slaDeadline: new Date("2026-06-11T09:00:00.000Z"),
  createdBy: { firstName: "Alex", lastName: "Admin" },
  technician: { firstName: "Taylor", lastName: "Tech" },
  facilityIssue: {
    id: ISSUE_ID,
    tenantId: TENANT_A,
    title: "Restroom leak",
    description: "Water pooling near sink in restroom 101",
    category: FacilityIssueCategory.PLUMBING,
    severity: IssueSeverity.HIGH,
    status: FacilityIssueStatus.IN_PROGRESS,
    createdAt: new Date("2026-06-10T07:30:00.000Z"),
    firstResponseAt: new Date("2026-06-10T08:15:00.000Z"),
    resolvedAt: null,
    workOrderId: WORK_ORDER_ID,
    room: { name: "Room 101" },
    location: null,
    reportedBy: { firstName: "Jamie", lastName: "Cleaner" }
  },
  partRequests: [
    {
      id: "pr-1",
      createdAt: new Date("2026-06-10T10:00:00.000Z"),
      status: "PENDING_OPERATIONAL",
      requestedQuantity: 2,
      part: { name: "Pipe seal", partNumber: "PS-001" },
      requestedBy: { firstName: "Taylor", lastName: "Tech" }
    }
  ]
};

describe("work order activity mapper", () => {
  it("builds derived timeline entries from real work order and linked issue fields", () => {
    const result = buildWorkOrderActivityTimeline(baseWorkOrderRecord);

    expect(result.workOrderId).toBe(WORK_ORDER_ID);
    expect(result.linkedFacilityIssue).toEqual(
      expect.objectContaining({
        id: ISSUE_ID,
        title: "Restroom leak",
        roomName: "Room 101"
      })
    );
    expect(result.entries.map((entry) => entry.type)).toEqual(
      expect.arrayContaining([
        "facility_issue_reported",
        "work_order_created",
        "work_due",
        "sla_deadline",
        "work_started",
        "part_requested",
        "facility_issue_first_response"
      ])
    );
    expect(sortWorkOrderActivityEntries(result.entries)).toEqual(result.entries);
    expect(new Date(result.entries[0].timestamp).getTime()).toBeLessThanOrEqual(
      new Date(result.entries[result.entries.length - 1].timestamp).getTime()
    );
  });

  it("excludes cross-tenant linked facility issue context", () => {
    const result = buildWorkOrderActivityTimeline({
      ...baseWorkOrderRecord,
      facilityIssue: {
        ...baseWorkOrderRecord.facilityIssue!,
        tenantId: TENANT_B
      }
    });

    expect(result.linkedFacilityIssue).toBeNull();
    expect(result.entries.some((entry) => entry.source === "facility_issue")).toBe(false);
    expect(result.entries.some((entry) => entry.type === "work_order_created")).toBe(true);
  });

  it("does not add completion or resolved events when timestamps are missing", () => {
    const result = buildWorkOrderActivityTimeline({
      ...baseWorkOrderRecord,
      completedDate: null,
      facilityIssue: {
        ...baseWorkOrderRecord.facilityIssue!,
        resolvedAt: null,
        firstResponseAt: null
      }
    });

    expect(result.entries.some((entry) => entry.type === "work_completed")).toBe(false);
    expect(result.entries.some((entry) => entry.type === "facility_issue_resolved")).toBe(false);
    expect(result.entries.some((entry) => entry.type === "facility_issue_first_response")).toBe(false);
  });

  it("maps public activity entries without sensitive fields or raw relations", () => {
    const result = buildWorkOrderActivityTimeline(baseWorkOrderRecord);

    for (const entry of result.entries) {
      expect(publicWorkOrderActivityEntryHasSensitiveFields(entry)).toBe(false);
      expect(publicWorkOrderActivityEntryHasRawRelations(entry)).toBe(false);
    }

    expect(publicWorkOrderActivityTimelineHasSensitiveFields(result)).toBe(false);
    expect(publicLinkedFacilityIssueSummaryHasSensitiveFields(result.linkedFacilityIssue)).toBe(false);
  });
});

describe("WorkOrderActivityService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: WorkOrderActivityService;

  const actor = {
    sub: "actor-1",
    email: "actor@example.com",
    role: RoleName.ADMIN,
    tenantId: TENANT_A
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new WorkOrderActivityService(prisma as never);
  });

  it("returns tenant-scoped activity timeline", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(baseWorkOrderRecord);

    const result = await service.getActivityTimeline(WORK_ORDER_ID, actor);

    expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WORK_ORDER_ID, tenantId: TENANT_A }
      })
    );
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.linkedFacilityIssue?.id).toBe(ISSUE_ID);
  });

  it("blocks cross-tenant work order activity lookup", async () => {
    prisma.workOrder.findFirst.mockResolvedValue(null);

    await expect(service.getActivityTimeline(WORK_ORDER_ID, actor)).rejects.toThrow(NotFoundException);
  });
});
