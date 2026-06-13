import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity,
  Priority,
  RoleName,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { CleaningService } from "../src/modules/cleaning/cleaning.service";
import {
  publicFacilityIssueResponseHasRawWorkOrderRelation,
  toPublicFacilityIssueResponse
} from "../src/modules/cleaning/facility-issue.mapper";
import type { JwtPayload } from "../src/modules/auth/auth.types";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const ISSUE_ID = "issue-1";
const WORK_ORDER_ID = "wo-1";
const ADMIN_ID = "admin-user";

const actor: JwtPayload = {
  sub: ADMIN_ID,
  email: "admin@example.com",
  role: RoleName.ADMIN,
  tenantId: TENANT_A
};

const baseIssueRecord = {
  id: ISSUE_ID,
  tenantId: TENANT_A,
  title: "Leak in restroom",
  description: "Water pooling near sink",
  category: FacilityIssueCategory.PLUMBING,
  severity: IssueSeverity.HIGH,
  status: FacilityIssueStatus.OPEN,
  locationId: "location-a",
  roomId: "room-a",
  workOrderId: null,
  photos: [],
  slaTargetAt: new Date("2026-06-02T10:00:00.000Z"),
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  resolutionMinutes: null,
  resolution: null,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
  updatedAt: new Date("2026-06-01T10:00:00.000Z"),
  location: {
    id: "location-a",
    name: "Restroom A",
    area: "North wing",
    building: "Tower A",
    floor: "1"
  },
  room: {
    id: "room-a",
    name: "Room 101",
    floorId: "floor-a",
    floor: {
      id: "floor-a",
      buildingId: "building-a",
      building: {
        id: "building-a",
        propertyId: "property-a"
      }
    }
  },
  workOrder: null,
  reportedBy: {
    id: "user-reporter",
    firstName: "Alex",
    lastName: "Reporter"
  },
  assignedTo: null,
  resolvedBy: null
};

const createdWorkOrder = {
  id: WORK_ORDER_ID,
  tenantId: TENANT_A,
  woNumber: "WO-2026-0042",
  title: "Leak in restroom",
  description: "Water pooling near sink",
  priority: Priority.HIGH,
  type: WorkOrderType.CORRECTIVE,
  status: WorkOrderStatus.OPEN,
  createdById: ADMIN_ID
};

const createPrismaMock = () => ({
  cleaningLocation: {
    findUnique: jest.fn()
  },
  room: {
    findFirst: jest.fn()
  },
  user: {
    findFirst: jest.fn()
  },
  facilityIssue: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn()
  }
});

const createService = (prisma: ReturnType<typeof createPrismaMock>) => {
  const notificationsService = {
    createNotification: jest.fn().mockResolvedValue(undefined)
  };
  const workOrdersService = {
    create: jest.fn(),
    assign: jest.fn()
  };

  const service = new CleaningService(
    prisma as never,
    { get: jest.fn() } as never,
    { toBuffer: jest.fn() } as never,
    notificationsService as never,
    workOrdersService as never
  );

  (service as unknown as { notifySupervisors: jest.Mock }).notifySupervisors = jest
    .fn()
    .mockResolvedValue(undefined);
  (service as unknown as { recordAudit: jest.Mock }).recordAudit = jest.fn().mockResolvedValue(undefined);
  (service as unknown as { ensureAssignableCleaner: jest.Mock }).ensureAssignableCleaner = jest
    .fn()
    .mockResolvedValue(undefined);

  return { service, workOrdersService };
};

const tenantContext = {
  actorId: actor.sub,
  actorEmail: actor.email,
  actorRole: actor.role,
  tenantId: TENANT_A,
  module: "cleaning",
  ipAddress: null,
  userAgent: null,
  requestPath: "/cleaning/issues/issue-1/create-work-order"
};

describe("facility issue work order bridge mapper", () => {
  it("maps allowlisted work order summary fields without raw workOrder relation", () => {
    const mapped = toPublicFacilityIssueResponse({
      ...baseIssueRecord,
      workOrderId: WORK_ORDER_ID,
      workOrder: {
        id: WORK_ORDER_ID,
        woNumber: "WO-2026-0042",
        title: "Leak in restroom",
        status: WorkOrderStatus.OPEN
      }
    });

    expect(mapped.workOrderId).toBe(WORK_ORDER_ID);
    expect(mapped.workOrderNumber).toBe("WO-2026-0042");
    expect(mapped.workOrderTitle).toBe("Leak in restroom");
    expect(mapped.workOrderStatus).toBe(WorkOrderStatus.OPEN);
    expect(publicFacilityIssueResponseHasRawWorkOrderRelation(mapped)).toBe(false);
  });
});

describe("CleaningService facility issue work order bridge", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CleaningService;
  let workOrdersService: ReturnType<typeof createService>["workOrdersService"];

  beforeEach(() => {
    prisma = createPrismaMock();
    ({ service, workOrdersService } = createService(prisma));
  });

  it("creates work order from same-tenant open issue and links it", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue(baseIssueRecord);
    workOrdersService.create.mockResolvedValue(createdWorkOrder);
    prisma.facilityIssue.update.mockResolvedValue({
      ...baseIssueRecord,
      workOrderId: WORK_ORDER_ID,
      workOrder: {
        id: WORK_ORDER_ID,
        woNumber: "WO-2026-0042",
        title: "Leak in restroom",
        status: WorkOrderStatus.OPEN
      }
    });

    const result = await requestContext.run(tenantContext, () =>
      service.createWorkOrderFromIssue(ISSUE_ID, actor)
    );

    expect(workOrdersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Leak in restroom",
        priority: Priority.HIGH,
        type: "CORRECTIVE",
        createdById: ADMIN_ID
      }),
      expect.objectContaining({ tenantId: TENANT_A })
    );
    expect(prisma.facilityIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ISSUE_ID },
        data: { workOrderId: WORK_ORDER_ID }
      })
    );
    expect(result.issue.workOrderId).toBe(WORK_ORDER_ID);
    expect(result.workOrder.workOrderNumber).toBe("WO-2026-0042");
    expect(publicFacilityIssueResponseHasRawWorkOrderRelation(result.issue)).toBe(false);
  });

  it("rejects duplicate work order creation for the same issue", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue({
      ...baseIssueRecord,
      workOrderId: WORK_ORDER_ID
    });

    await expect(
      requestContext.run(tenantContext, () => service.createWorkOrderFromIssue(ISSUE_ID, actor))
    ).rejects.toThrow(ConflictException);

    expect(workOrdersService.create).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant issue bridging", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue({
      ...baseIssueRecord,
      tenantId: TENANT_B
    });

    await expect(
      requestContext.run(tenantContext, () => service.createWorkOrderFromIssue(ISSUE_ID, actor))
    ).rejects.toThrow(NotFoundException);

    expect(workOrdersService.create).not.toHaveBeenCalled();
  });

  it("rejects resolved or closed issues", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue({
      ...baseIssueRecord,
      status: FacilityIssueStatus.RESOLVED
    });

    await expect(
      requestContext.run(tenantContext, () => service.createWorkOrderFromIssue(ISSUE_ID, actor))
    ).rejects.toThrow(BadRequestException);
  });

  it("assigns linked work order to issue assignee when present", async () => {
    workOrdersService.create.mockResolvedValue(createdWorkOrder);
    prisma.facilityIssue.update.mockResolvedValue({
      ...baseIssueRecord,
      workOrderId: WORK_ORDER_ID,
      assignedToId: "tech-1",
      workOrder: {
        id: WORK_ORDER_ID,
        woNumber: "WO-2026-0042",
        title: "Leak in restroom",
        status: WorkOrderStatus.OPEN
      }
    });
    prisma.facilityIssue.findUnique
      .mockResolvedValueOnce({
        ...baseIssueRecord,
        assignedToId: "tech-1",
        assignedTo: {
          id: "tech-1",
          firstName: "Taylor",
          lastName: "Tech"
        }
      })
      .mockResolvedValueOnce({
        ...baseIssueRecord,
        workOrderId: WORK_ORDER_ID,
        workOrder: {
          id: WORK_ORDER_ID,
          woNumber: "WO-2026-0042",
          title: "Leak in restroom",
          status: WorkOrderStatus.IN_PROGRESS
        }
      });

    await requestContext.run(tenantContext, () => service.createWorkOrderFromIssue(ISSUE_ID, actor));

    expect(workOrdersService.assign).toHaveBeenCalledWith(
      WORK_ORDER_ID,
      "tech-1",
      expect.objectContaining({ tenantId: TENANT_A })
    );
  });
});
