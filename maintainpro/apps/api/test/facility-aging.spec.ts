import { BadRequestException } from "@nestjs/common";
import {
  FacilityIssueStatus,
  IssueSeverity,
  WorkOrderStatus
} from "@prisma/client";

import { FacilitiesService } from "../src/modules/facilities/facilities.service";
import {
  accumulateIssueAgeBuckets,
  buildFacilityAgingReport,
  calculateAgeDays,
  publicFacilityAgingHasFakeMetricHelpers,
  publicFacilityAgingHasSensitiveFields,
  resolveAgeBucketKey
} from "../src/modules/facilities/facility-aging.mapper";

const TENANT_A = "tenant-a";

describe("facility aging mapper", () => {
  const now = new Date("2026-06-12T12:00:00.000Z");

  it("calculates age buckets from issue creation age", () => {
    expect(resolveAgeBucketKey(0)).toBe("0_1");
    expect(resolveAgeBucketKey(1)).toBe("0_1");
    expect(resolveAgeBucketKey(2)).toBe("2_3");
    expect(resolveAgeBucketKey(7)).toBe("4_7");
    expect(resolveAgeBucketKey(8)).toBe("8_plus");
  });

  it("counts overdue issues from SLA target dates", () => {
    const result = accumulateIssueAgeBuckets(
      [
        {
          createdAt: new Date("2026-06-11T12:00:00.000Z"),
          severity: IssueSeverity.HIGH,
          status: FacilityIssueStatus.OPEN,
          slaTargetAt: new Date("2026-06-10T12:00:00.000Z")
        }
      ],
      now
    );

    expect(result.overdueCount).toBe(1);
    expect(result.buckets.find((row) => row.key === "0_1")?.count).toBe(1);
    expect(result.criticalHighActiveCount).toBe(1);
  });

  it("builds public aging report without fake helper values", () => {
    const report = buildFacilityAgingReport({
      now,
      activeIssues: [
        {
          id: "issue-1",
          title: "Leak",
          severity: IssueSeverity.CRITICAL,
          status: FacilityIssueStatus.OPEN,
          category: null,
          slaTargetAt: new Date("2026-06-10T12:00:00.000Z"),
          workOrderId: null,
          createdAt: new Date("2026-06-01T12:00:00.000Z"),
          room: { name: "Room 101" },
          workOrder: null
        }
      ],
      overdueIssuesPreview: [],
      criticalHighIssuesPreview: [],
      workOrdersWithDueDate: [
        {
          id: "wo-1",
          woNumber: "WO-1",
          title: "Fix leak",
          status: WorkOrderStatus.OPEN,
          dueDate: new Date("2026-06-11T12:00:00.000Z"),
          createdAt: new Date("2026-06-05T12:00:00.000Z"),
          facilityIssueId: "issue-1"
        }
      ]
    });

    expect(report.issues.activeIssueCount).toBe(1);
    expect(report.workOrders.overdueCount).toBe(1);
    expect(publicFacilityAgingHasSensitiveFields(report)).toBe(false);
    expect(publicFacilityAgingHasFakeMetricHelpers(report)).toBe(false);
    expect(calculateAgeDays(new Date("2026-06-10T12:00:00.000Z"), now)).toBe(2);
  });
});

describe("FacilitiesService aging report", () => {
  const prisma = {
    facilityIssue: {
      findMany: jest.fn()
    }
  };

  const service = new FacilitiesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires tenant context", async () => {
    await expect(service.getAgingReport(null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("scopes aging queries to tenant and uses real issue/work order fields only", async () => {
    prisma.facilityIssue.findMany
      .mockResolvedValueOnce([
        {
          id: "issue-1",
          title: "Leak",
          severity: IssueSeverity.HIGH,
          status: FacilityIssueStatus.OPEN,
          category: null,
          slaTargetAt: new Date("2026-06-10T12:00:00.000Z"),
          workOrderId: "wo-1",
          createdAt: new Date("2026-06-01T12:00:00.000Z"),
          room: { name: "Room 101" },
          workOrder: { woNumber: "WO-1" }
        }
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "issue-1",
          workOrderId: "wo-1",
          workOrder: {
            id: "wo-1",
            woNumber: "WO-1",
            title: "Fix leak",
            status: WorkOrderStatus.OPEN,
            dueDate: new Date("2026-06-11T12:00:00.000Z"),
            createdAt: new Date("2026-06-05T12:00:00.000Z")
          }
        }
      ]);

    const report = await service.getAgingReport(TENANT_A);

    expect(prisma.facilityIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A })
      })
    );
    expect(report.issues.activeIssueCount).toBe(1);
    expect(report.workOrders.withDueDateCount).toBe(1);
    expect(publicFacilityAgingHasSensitiveFields(report)).toBe(false);
  });

  it("returns empty aging state for tenants without active issues", async () => {
    prisma.facilityIssue.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const report = await service.getAgingReport(TENANT_A);

    expect(report.issues.activeIssueCount).toBe(0);
    expect(report.issues.overdueIssueCount).toBe(0);
    expect(report.workOrders.trackingAvailable).toBe(false);
  });
});
