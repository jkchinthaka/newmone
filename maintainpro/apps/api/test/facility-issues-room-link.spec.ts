import { BadRequestException } from "@nestjs/common";
import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
} from "@prisma/client";

import { requestContext, type AuditRequestContext } from "../src/common/context/request-context";
import { CleaningService } from "../src/modules/cleaning/cleaning.service";
import {
  publicFacilityIssueResponseHasRawRoomRelation,
  publicFacilityIssueResponseHasSensitiveFields,
  toPublicFacilityIssueResponse
} from "../src/modules/cleaning/facility-issue.mapper";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const REPORTER_ID = "user-reporter";

// Fail-closed cleaning ownership checks resolve the actor tenant from the request
// context; wrap service calls that read persisted records with an active context.
const withTenant = <T>(tenantId: string, fn: () => Promise<T>): Promise<T> => {
  const context: AuditRequestContext = {
    actorId: REPORTER_ID,
    actorEmail: null,
    actorRole: null,
    tenantId,
    module: null,
    ipAddress: null,
    userAgent: null,
    requestPath: null
  };
  return requestContext.run(context, fn);
};
const ROOM_A = "room-a";
const ROOM_B = "room-b";
const LOCATION_A = "location-a";

const reportedBy = {
  id: REPORTER_ID,
  firstName: "Alex",
  lastName: "Reporter"
};

const roomGraph = {
  id: ROOM_A,
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
};

const baseIssueRecord = {
  id: "issue-1",
  tenantId: TENANT_A,
  title: "Leak in restroom",
  description: "Water pooling near sink",
  category: FacilityIssueCategory.PLUMBING,
  severity: IssueSeverity.HIGH,
  status: FacilityIssueStatus.OPEN,
  locationId: LOCATION_A,
  roomId: ROOM_A,
  photos: [],
  slaTargetAt: null,
  firstResponseAt: null,
  resolvedAt: null,
  closedAt: null,
  resolutionMinutes: null,
  resolution: null,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
  updatedAt: new Date("2026-06-01T10:00:00.000Z"),
  location: {
    id: LOCATION_A,
    name: "Restroom A",
    area: "North wing",
    building: "Tower A",
    floor: "1"
  },
  room: roomGraph,
  reportedBy,
  assignedTo: null,
  resolvedBy: null,
  workOrderId: null,
  workOrder: null
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

  return { service, notificationsService };
};

describe("facility issue room linkage mapper", () => {
  it("maps allowlisted room summary fields without raw room relation", () => {
    const mapped = toPublicFacilityIssueResponse(baseIssueRecord);

    expect(mapped.roomId).toBe(ROOM_A);
    expect(mapped.roomName).toBe("Room 101");
    expect(mapped.floorId).toBe("floor-a");
    expect(mapped.buildingId).toBe("building-a");
    expect(mapped.propertyId).toBe("property-a");
    expect(mapped.category).toBe(FacilityIssueCategory.PLUMBING);
    expect(mapped.location?.name).toBe("Restroom A");
    expect(publicFacilityIssueResponseHasRawRoomRelation(mapped)).toBe(false);
    expect(publicFacilityIssueResponseHasSensitiveFields(mapped)).toBe(false);
  });

  it("leaves room summary null when roomId is absent", () => {
    const mapped = toPublicFacilityIssueResponse({
      ...baseIssueRecord,
      roomId: null,
      room: null,
      category: null
    });

    expect(mapped.roomId).toBeNull();
    expect(mapped.roomName).toBeNull();
    expect(mapped.floorId).toBeNull();
    expect(mapped.category).toBeNull();
    expect(mapped.severity).toBe(IssueSeverity.HIGH);
  });
});

describe("CleaningService facility issue room linkage", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: CleaningService;

  beforeEach(() => {
    prisma = createPrismaMock();
    ({ service } = createService(prisma));
  });

  it("creates issue without roomId using existing location flow", async () => {
    prisma.cleaningLocation.findUnique.mockResolvedValue({
      id: LOCATION_A,
      tenantId: TENANT_A,
      isActive: true
    });
    prisma.facilityIssue.create.mockResolvedValue({
      ...baseIssueRecord,
      roomId: null,
      room: null,
      category: null,
      severity: IssueSeverity.MEDIUM
    });

    const result = await service.createIssue(REPORTER_ID, TENANT_A, {
      title: "Broken light",
      description: "Corridor light flickering",
      locationId: LOCATION_A
    });

    expect(prisma.room.findFirst).not.toHaveBeenCalled();
    expect(prisma.facilityIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationId: LOCATION_A,
          roomId: undefined,
          severity: IssueSeverity.MEDIUM
        })
      })
    );
    expect(result.locationId).toBe(LOCATION_A);
    expect(result.roomId).toBeNull();
  });

  it("creates issue with valid same-tenant roomId", async () => {
    prisma.room.findFirst.mockResolvedValue({
      id: ROOM_A,
      tenantId: TENANT_A,
      isActive: true
    });
    prisma.facilityIssue.create.mockResolvedValue(baseIssueRecord);

    const result = await service.createIssue(REPORTER_ID, TENANT_A, {
      title: "Leak in restroom",
      description: "Water pooling near sink",
      roomId: ROOM_A,
      category: FacilityIssueCategory.PLUMBING,
      severity: IssueSeverity.HIGH
    });

    expect(prisma.room.findFirst).toHaveBeenCalledWith({
      where: { id: ROOM_A, tenantId: TENANT_A },
      select: { id: true, tenantId: true, isActive: true }
    });
    expect(result.roomId).toBe(ROOM_A);
    expect(result.roomName).toBe("Room 101");
    expect(result.category).toBe(FacilityIssueCategory.PLUMBING);
  });

  it("rejects cross-tenant roomId on create", async () => {
    // The tenant-scoped findFirst({ id, tenantId }) yields nothing for a room in
    // another tenant, so the ownership guard rejects the link.
    prisma.room.findFirst.mockResolvedValue(null);

    await expect(
      service.createIssue(REPORTER_ID, TENANT_A, {
        title: "Unauthorized room link",
        description: "Should fail tenant validation",
        roomId: ROOM_B
      })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.room.findFirst).toHaveBeenCalledWith({
      where: { id: ROOM_B, tenantId: TENANT_A },
      select: { id: true, tenantId: true, isActive: true }
    });
  });

  it("rejects unknown or inactive room on create", async () => {
    prisma.room.findFirst.mockResolvedValue(null);

    await expect(
      service.createIssue(REPORTER_ID, TENANT_A, {
        title: "Missing room",
        description: "Room does not exist",
        roomId: "missing-room"
      })
    ).rejects.toThrow("Room is invalid for this tenant");
  });

  it("updates issue with valid roomId", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue({
      ...baseIssueRecord,
      roomId: null,
      room: null
    });
    prisma.room.findFirst.mockResolvedValue({
      id: ROOM_A,
      tenantId: TENANT_A,
      isActive: true
    });
    prisma.facilityIssue.update.mockResolvedValue(baseIssueRecord);

    const result = await withTenant(TENANT_A, () =>
      service.updateIssue("issue-1", REPORTER_ID, {
        roomId: ROOM_A,
        category: FacilityIssueCategory.PLUMBING
      })
    );

    expect(prisma.facilityIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roomId: ROOM_A,
          category: FacilityIssueCategory.PLUMBING
        })
      })
    );
    expect(result.roomId).toBe(ROOM_A);
  });

  it("allows clearing roomId on update", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue(baseIssueRecord);
    prisma.facilityIssue.update.mockResolvedValue({
      ...baseIssueRecord,
      roomId: null,
      room: null
    });

    const result = await withTenant(TENANT_A, () =>
      service.updateIssue("issue-1", REPORTER_ID, {
        roomId: null
      })
    );

    expect(prisma.room.findFirst).not.toHaveBeenCalled();
    expect(prisma.facilityIssue.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roomId: null })
      })
    );
    expect(result.roomId).toBeNull();
  });

  it("rejects cross-tenant roomId on update", async () => {
    prisma.facilityIssue.findUnique.mockResolvedValue({
      ...baseIssueRecord,
      roomId: null,
      room: null
    });
    // Tenant-scoped lookup returns nothing for a room owned by another tenant.
    prisma.room.findFirst.mockResolvedValue(null);

    await expect(
      withTenant(TENANT_A, () =>
        service.updateIssue("issue-1", REPORTER_ID, {
          roomId: ROOM_B
        })
      )
    ).rejects.toThrow(BadRequestException);
  });

  it("lists issues with allowlisted room summary only", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([baseIssueRecord]);

    const rows = await service.listIssues(TENANT_A);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.roomName).toBe("Room 101");
    expect(publicFacilityIssueResponseHasRawRoomRelation(rows[0])).toBe(false);
    expect(rows[0]?.location?.name).toBe("Restroom A");
  });

  it("preserves locationId behavior when roomId is not supplied", async () => {
    prisma.cleaningLocation.findUnique.mockResolvedValue({
      id: LOCATION_A,
      tenantId: TENANT_A,
      isActive: true
    });
    prisma.facilityIssue.create.mockResolvedValue({
      ...baseIssueRecord,
      roomId: null,
      room: null
    });

    const result = await service.createIssue(REPORTER_ID, TENANT_A, {
      title: "Legacy cleaning issue",
      description: "Uses CleaningLocation only",
      locationId: LOCATION_A
    });

    expect(result.locationId).toBe(LOCATION_A);
    expect(result.location?.name).toBe("Restroom A");
    expect(result.roomId).toBeNull();
  });
});
