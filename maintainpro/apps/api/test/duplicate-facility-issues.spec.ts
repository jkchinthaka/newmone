import { BadRequestException } from "@nestjs/common";
import {
  FacilityIssueCategory,
  FacilityIssueStatus,
  IssueSeverity
} from "@prisma/client";

import { DuplicateFacilityIssueService } from "../src/modules/cleaning/duplicate-facility-issue.service";
import {
  computeDuplicateTextOverlapScore,
  DUPLICATE_ISSUE_MAX_CANDIDATES,
  publicDuplicateFacilityIssueCandidateHasRawRelations,
  publicDuplicateFacilityIssueCandidateHasSensitiveFields,
  resolveDuplicateIssueConfidence,
  sortDuplicateFacilityIssueCandidates,
  toPublicDuplicateFacilityIssueCandidate
} from "../src/modules/cleaning/duplicate-facility-issue.mapper";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const ROOM_A = "room-a";
const LOCATION_A = "location-a";

const configService = (values: Record<string, unknown> = {}) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

const createPrismaMock = () => ({
  room: { findFirst: jest.fn() },
  cleaningLocation: { findFirst: jest.fn() },
  facilityIssue: { findMany: jest.fn() }
});

describe("duplicate facility issue mapper", () => {
  it("scores deterministic text overlap without external services", () => {
    expect(computeDuplicateTextOverlapScore("Restroom leak near sink", "Restroom leak near sink")).toBe(1);
    expect(computeDuplicateTextOverlapScore("Broken light corridor", "Water leak restroom")).toBe(0);
  });

  it("resolves HIGH/MEDIUM/LOW confidence deterministically", () => {
    expect(
      resolveDuplicateIssueConfidence({
        inputCategory: FacilityIssueCategory.PLUMBING,
        candidateCategory: FacilityIssueCategory.PLUMBING,
        textScore: 0.75,
        sharedTokens: 4
      })?.confidence
    ).toBe("HIGH");

    expect(
      resolveDuplicateIssueConfidence({
        inputCategory: FacilityIssueCategory.PLUMBING,
        candidateCategory: FacilityIssueCategory.PLUMBING,
        textScore: 0.1,
        sharedTokens: 0
      })?.confidence
    ).toBe("MEDIUM");

    expect(
      resolveDuplicateIssueConfidence({
        inputCategory: null,
        candidateCategory: FacilityIssueCategory.PLUMBING,
        textScore: 0.3,
        sharedTokens: 2
      })?.confidence
    ).toBe("LOW");
  });

  it("maps public duplicate candidates without raw relations", () => {
    const candidate = toPublicDuplicateFacilityIssueCandidate(
      {
        id: "issue-1",
        title: "Leak",
        description: "Water pooling near sink in restroom",
        status: FacilityIssueStatus.OPEN,
        category: FacilityIssueCategory.PLUMBING,
        severity: IssueSeverity.HIGH,
        workOrderId: null,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        location: { name: "Restroom A" },
        room: { name: "Room 101" }
      },
      "HIGH",
      "Same location with matching category and similar title/description text"
    );

    expect(publicDuplicateFacilityIssueCandidateHasSensitiveFields({ tenantId: TENANT_A })).toBe(true);
    expect(publicDuplicateFacilityIssueCandidateHasSensitiveFields(candidate)).toBe(false);
    expect(publicDuplicateFacilityIssueCandidateHasRawRelations(candidate)).toBe(false);
    expect(candidate.roomName).toBe("Room 101");
  });

  it("sorts candidates by confidence then recency", () => {
    const sorted = sortDuplicateFacilityIssueCandidates([
      {
        id: "low",
        title: "A",
        descriptionPreview: "A",
        status: FacilityIssueStatus.OPEN,
        category: null,
        severity: IssueSeverity.LOW,
        roomName: "Room",
        locationName: null,
        createdAt: "2026-06-09T10:00:00.000Z",
        workOrderId: null,
        confidence: "LOW",
        reason: "low"
      },
      {
        id: "high",
        title: "B",
        descriptionPreview: "B",
        status: FacilityIssueStatus.OPEN,
        category: FacilityIssueCategory.PLUMBING,
        severity: IssueSeverity.HIGH,
        roomName: "Room",
        locationName: null,
        createdAt: "2026-06-08T10:00:00.000Z",
        workOrderId: null,
        confidence: "HIGH",
        reason: "high"
      }
    ]);

    expect(sorted[0]?.id).toBe("high");
  });
});

describe("DuplicateFacilityIssueService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: DuplicateFacilityIssueService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new DuplicateFacilityIssueService(prisma as never, configService({ DUPLICATE_ISSUE_WINDOW_DAYS: 7 }));
    prisma.room.findFirst.mockResolvedValue({ id: ROOM_A });
    prisma.cleaningLocation.findFirst.mockResolvedValue({ id: LOCATION_A });
  });

  it("requires tenant context", async () => {
    await expect(
      service.checkDuplicates(null, {
        title: "Leak",
        roomId: ROOM_A
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns no candidates when room/location are absent", async () => {
    const result = await service.checkDuplicates(TENANT_A, {
      title: "Leak",
      description: "Water near sink"
    });

    expect(result.candidates).toEqual([]);
    expect(prisma.facilityIssue.findMany).not.toHaveBeenCalled();
  });

  it("detects duplicate for same tenant room category and similar text", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([
      {
        id: "issue-1",
        title: "Restroom leak",
        description: "Water pooling near sink",
        status: FacilityIssueStatus.OPEN,
        category: FacilityIssueCategory.PLUMBING,
        severity: IssueSeverity.HIGH,
        workOrderId: null,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        location: { name: "Restroom A" },
        room: { name: "Room 101" }
      }
    ]);

    const result = await service.checkDuplicates(TENANT_A, {
      title: "Restroom leak",
      description: "Water pooling near sink in restroom",
      category: FacilityIssueCategory.PLUMBING,
      roomId: ROOM_A
    });

    expect(prisma.facilityIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          roomId: ROOM_A,
          category: FacilityIssueCategory.PLUMBING,
          status: { in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS] }
        })
      })
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.confidence).toBe("HIGH");
  });

  it("detects duplicate for same legacy location", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([
      {
        id: "issue-2",
        title: "Broken light",
        description: "Corridor light flickering",
        status: FacilityIssueStatus.IN_PROGRESS,
        category: FacilityIssueCategory.ELECTRICAL,
        severity: IssueSeverity.MEDIUM,
        workOrderId: "wo-1",
        createdAt: new Date("2026-06-11T10:00:00.000Z"),
        location: { name: "Corridor A" },
        room: null
      }
    ]);

    const result = await service.checkDuplicates(TENANT_A, {
      title: "Broken corridor light",
      description: "Corridor light flickering again",
      category: FacilityIssueCategory.ELECTRICAL,
      locationId: LOCATION_A
    });

    expect(result.candidates[0]?.locationName).toBe("Corridor A");
    expect(result.candidates[0]?.workOrderId).toBe("wo-1");
  });

  it("scopes query to tenant and excludes resolved/closed via status filter", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([]);

    await service.checkDuplicates(TENANT_A, {
      title: "Leak",
      description: "Water leak",
      roomId: ROOM_A
    });

    expect(prisma.facilityIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A,
          status: { in: [FacilityIssueStatus.OPEN, FacilityIssueStatus.IN_PROGRESS] }
        })
      })
    );
  });

  it("caps candidates to max 5", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue(
      Array.from({ length: 10 }).map((_, index) => ({
        id: `issue-${index}`,
        title: `Restroom leak ${index}`,
        description: "Water pooling near sink",
        status: FacilityIssueStatus.OPEN,
        category: FacilityIssueCategory.PLUMBING,
        severity: IssueSeverity.HIGH,
        workOrderId: null,
        createdAt: new Date(`2026-06-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`),
        location: { name: "Restroom A" },
        room: { name: "Room 101" }
      }))
    );

    const result = await service.checkDuplicates(TENANT_A, {
      title: "Restroom leak",
      description: "Water pooling near sink",
      category: FacilityIssueCategory.PLUMBING,
      roomId: ROOM_A
    });

    expect(result.candidates.length).toBeLessThanOrEqual(DUPLICATE_ISSUE_MAX_CANDIDATES);
  });

  it("does not return raw relation payloads", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([
      {
        id: "issue-1",
        title: "Restroom leak",
        description: "Water pooling near sink",
        status: FacilityIssueStatus.OPEN,
        category: FacilityIssueCategory.PLUMBING,
        severity: IssueSeverity.HIGH,
        workOrderId: null,
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        location: { name: "Restroom A" },
        room: { name: "Room 101" }
      }
    ]);

    const result = await service.checkDuplicates(TENANT_A, {
      title: "Restroom leak",
      description: "Water pooling near sink",
      category: FacilityIssueCategory.PLUMBING,
      roomId: ROOM_A
    });

    expect(publicDuplicateFacilityIssueCandidateHasRawRelations(result.candidates[0])).toBe(false);
  });

  it("rejects invalid room for tenant", async () => {
    prisma.room.findFirst.mockResolvedValue(null);

    await expect(
      service.checkDuplicates(TENANT_A, {
        title: "Leak",
        roomId: ROOM_A
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("never queries with spoofed tenant id from body", async () => {
    prisma.facilityIssue.findMany.mockResolvedValue([]);

    await service.checkDuplicates(TENANT_A, {
      title: "Leak",
      roomId: ROOM_A
    });

    expect(prisma.facilityIssue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_A
        })
      })
    );
    expect(TENANT_B).not.toBe(TENANT_A);
  });
});
