import { BadRequestException } from "@nestjs/common";
import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
} from "@prisma/client";

import { FacilitiesService } from "../src/modules/facilities/facilities.service";
import {
  publicFacilityDashboardHasRawRelations,
  publicFacilityDashboardHasSensitiveFields,
  toPublicFacilityIssuePreview
} from "../src/modules/facilities/facility-dashboard.mapper";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const createPrismaMock = () => ({
  property: { count: jest.fn() },
  building: { count: jest.fn() },
  floor: { count: jest.fn() },
  room: { count: jest.fn(), findMany: jest.fn() },
  facilityIssue: {
    count: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn()
  }
});

describe("facility dashboard mapper", () => {
  it("maps issue previews without raw relation payloads", () => {
    const preview = toPublicFacilityIssuePreview({
      id: "issue-1",
      title: "Leak",
      severity: IssueSeverity.HIGH,
      status: FacilityIssueStatus.OPEN,
      category: FacilityIssueCategory.PLUMBING,
      slaTargetAt: new Date("2026-06-10T10:00:00.000Z"),
      workOrderId: "wo-1",
      createdAt: new Date("2026-06-09T10:00:00.000Z"),
      room: { name: "Room 101" },
      workOrder: { woNumber: "WO-2026-0001" }
    });

    expect(preview.roomName).toBe("Room 101");
    expect(preview.workOrderNumber).toBe("WO-2026-0001");
    expect(publicFacilityDashboardHasRawRelations(preview)).toBe(false);
    expect(publicFacilityDashboardHasSensitiveFields({ generatedAt: new Date().toISOString() })).toBe(
      false
    );
    expect(publicFacilityDashboardHasSensitiveFields({ tenantId: TENANT_A })).toBe(true);
  });
});

describe("FacilitiesService dashboard summary", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: FacilitiesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new FacilitiesService(prisma as never);

    prisma.property.count.mockResolvedValue(1);
    prisma.building.count.mockResolvedValue(2);
    prisma.floor.count.mockResolvedValue(3);
    prisma.room.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
    prisma.facilityIssue.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5);
    prisma.facilityIssue.groupBy
      .mockResolvedValueOnce([
        { category: FacilityIssueCategory.PLUMBING, _count: { _all: 3 } }
      ])
      .mockResolvedValueOnce([{ severity: IssueSeverity.HIGH, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ status: FacilityIssueStatus.OPEN, _count: { _all: 4 } }])
      .mockResolvedValueOnce([{ roomId: "room-a", _count: { _all: 2 } }]);
    prisma.room.findMany.mockResolvedValue([{ id: "room-a", name: "Room 101" }]);
    prisma.facilityIssue.findMany
      .mockResolvedValueOnce([
        {
          id: "issue-overdue",
          title: "Overdue leak",
          severity: IssueSeverity.HIGH,
          status: FacilityIssueStatus.OPEN,
          category: FacilityIssueCategory.PLUMBING,
          slaTargetAt: new Date("2026-06-01T10:00:00.000Z"),
          workOrderId: null,
          createdAt: new Date("2026-06-01T09:00:00.000Z"),
          room: { name: "Room 101" },
          workOrder: null
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  });

  it("returns tenant-scoped summary counts from real aggregation queries", async () => {
    const summary = await service.getDashboardSummary(TENANT_A);

    expect(summary.hierarchy.propertyCount).toBe(1);
    expect(summary.hierarchy.roomCount).toBe(4);
    expect(summary.issues.totalIssueCount).toBe(10);
    expect(summary.issues.overdueIssueCount).toBe(2);
    expect(summary.workOrderBridge.linkedWorkOrderCount).toBe(3);
    expect(summary.breakdowns.byCategory[0]?.count).toBe(3);
    expect(summary.attention.topRoomsByOpenIssues[0]?.roomName).toBe("Room 101");
    expect(publicFacilityDashboardHasRawRelations(summary)).toBe(false);
    expect(prisma.facilityIssue.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A })
      })
    );
  });

  it("requires tenant context for SUPER_ADMIN-style callers", async () => {
    await expect(service.getDashboardSummary(null)).rejects.toThrow(BadRequestException);
    expect(prisma.facilityIssue.count).not.toHaveBeenCalled();
  });

  it("scopes facility issue queries to the provided tenant only", async () => {
    await service.getDashboardSummary(TENANT_A);

    expect(prisma.facilityIssue.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A })
      })
    );
    expect(prisma.facilityIssue.groupBy).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_B })
      })
    );
  });
});
