import { ConfigService } from "@nestjs/config";

import { FacilityLocationBackfillService } from "../src/modules/facilities/facility-location-backfill.service";
import {
  matchCleaningLocationToRooms,
  type CleaningLocationMatchInput,
  type RoomHierarchyMatchInput
} from "../src/modules/facilities/facility-location-backfill.matcher";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const room = (overrides: Partial<RoomHierarchyMatchInput> = {}): RoomHierarchyMatchInput => ({
  id: "room-1",
  tenantId: TENANT_A,
  name: "Lobby restroom",
  code: "LR-01",
  floor: {
    name: "Ground",
    levelNumber: 0,
    building: {
      name: "Main Tower",
      code: "MT"
    }
  },
  ...overrides
});

const location = (overrides: Partial<CleaningLocationMatchInput> = {}): CleaningLocationMatchInput => ({
  id: "loc-1",
  tenantId: TENANT_A,
  name: "Lobby restroom",
  area: "Lobby restroom",
  building: "Main Tower",
  floor: "Ground",
  ...overrides
});

describe("facility location backfill matcher", () => {
  it("matches exact room candidates within tenant", () => {
    const report = matchCleaningLocationToRooms(location(), [room()]);
    expect(report.confidence).toBe("exact");
    expect(report.candidateRoomId).toBe("room-1");
  });

  it("returns likely match when floor metadata differs", () => {
    const report = matchCleaningLocationToRooms(location({ floor: "Level 1" }), [room()]);
    expect(report.confidence).toBe("likely");
    expect(report.candidateRoomId).toBe("room-1");
  });

  it("returns ambiguous when multiple exact candidates exist", () => {
    const report = matchCleaningLocationToRooms(location(), [
      room({ id: "room-1" }),
      room({ id: "room-2", code: "LR-02" })
    ]);
    expect(report.confidence).toBe("ambiguous");
    expect(report.candidateRoomId).toBeNull();
  });

  it("returns none when no room matches", () => {
    const report = matchCleaningLocationToRooms(
      location({ name: "Roof deck", area: "Roof deck" }),
      [room()]
    );
    expect(report.confidence).toBe("none");
  });

  it("rejects cross-tenant matching", () => {
    const report = matchCleaningLocationToRooms(location({ tenantId: TENANT_B }), [room()]);
    expect(report.confidence).toBe("none");
  });
});

describe("FacilityLocationBackfillService", () => {
  const prisma = {
    cleaningLocation: { findMany: jest.fn() },
    room: { findMany: jest.fn() },
    facilityIssue: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() }
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key === "ALLOW_FACILITY_BACKFILL_APPLY" ? false : fallback
    )
  } as unknown as ConfigService;

  const service = new FacilityLocationBackfillService(prisma as never, configService);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.cleaningLocation.findMany.mockResolvedValue([
      {
        id: "loc-1",
        tenantId: TENANT_A,
        name: "Lobby restroom",
        area: "Lobby restroom",
        building: "Main Tower",
        floor: "Ground"
      }
    ]);
    prisma.room.findMany.mockResolvedValue([
      {
        id: "room-1",
        tenantId: TENANT_A,
        name: "Lobby restroom",
        code: "LR-01",
        floor: {
          name: "Ground",
          levelNumber: 0,
          building: { name: "Main Tower", code: "MT" }
        }
      }
    ]);
    prisma.facilityIssue.count.mockResolvedValue(2);
  });

  it("runs dry-run without mutating data", async () => {
    const summary = await service.run({ tenantId: TENANT_A });

    expect(summary.dryRun).toBe(true);
    expect(summary.totals.exactCount).toBe(1);
    expect(summary.totals.issuesUpdated).toBe(0);
    expect(prisma.facilityIssue.updateMany).not.toHaveBeenCalled();
  });

  it("blocks apply mode unless env guard is enabled", async () => {
    await expect(service.run({ tenantId: TENANT_A, apply: true })).rejects.toThrow(/Apply mode blocked/);
  });
});
