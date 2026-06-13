import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FacilityRoomType } from "@prisma/client";

import { FacilitiesService } from "../src/modules/facilities/facilities.service";
import {
  publicFacilityResponseHasSensitiveFields,
  toPublicPropertyResponse
} from "../src/modules/facilities/facility-hierarchy.mapper";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const propertyA = {
  id: "property-a",
  tenantId: TENANT_A,
  name: "Nelna HQ",
  code: "HQ",
  address: "Colombo",
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z")
};

const propertyB = {
  ...propertyA,
  id: "property-b",
  tenantId: TENANT_B,
  code: "HQ-B"
};

const buildingA = {
  id: "building-a",
  tenantId: TENANT_A,
  propertyId: propertyA.id,
  name: "Tower A",
  code: "TWR-A",
  description: null,
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z")
};

const floorA = {
  id: "floor-a",
  tenantId: TENANT_A,
  buildingId: buildingA.id,
  name: "Level 1",
  levelNumber: 1,
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z")
};

const roomA = {
  id: "room-a",
  tenantId: TENANT_A,
  floorId: floorA.id,
  name: "Room 101",
  code: "101",
  roomType: FacilityRoomType.OFFICE,
  isActive: true,
  createdAt: new Date("2026-06-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z")
};

const createPrismaMock = () => ({
  property: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  building: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  floor: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  },
  room: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
});

describe("FacilitiesService hierarchy", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: FacilitiesService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new FacilitiesService(prisma as never);
  });

  it("requires tenant context for mutations and reads", async () => {
    await expect(service.listProperties(null)).rejects.toThrow(BadRequestException);
    await expect(
      service.createProperty(null, { name: "Site", code: "SITE" })
    ).rejects.toThrow(BadRequestException);
  });

  it("creates a property scoped to the caller tenant", async () => {
    prisma.property.create.mockResolvedValue(propertyA);

    const result = await service.createProperty(TENANT_A, {
      name: "Nelna HQ",
      code: "hq",
      address: "Colombo"
    });

    expect(prisma.property.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_A,
        name: "Nelna HQ",
        code: "HQ",
        address: "Colombo"
      }
    });
    expect(result.tenantId).toBe(TENANT_A);
    expect(publicFacilityResponseHasSensitiveFields(result as unknown as Record<string, unknown>)).toBe(false);
  });

  it("lists properties only for the caller tenant", async () => {
    prisma.property.findMany.mockResolvedValue([propertyA]);

    const rows = await service.listProperties(TENANT_A);

    expect(prisma.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_A, isActive: true })
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("property-a");
  });

  it("does not return another tenant's property on get", async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(service.getProperty(TENANT_A, propertyB.id)).rejects.toThrow(NotFoundException);
    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyB.id, tenantId: TENANT_A }
    });
  });

  it("creates a building only when the parent property belongs to the same tenant", async () => {
    prisma.property.findFirst.mockResolvedValue({ id: propertyA.id });
    prisma.building.create.mockResolvedValue(buildingA);

    const result = await service.createBuilding(TENANT_A, {
      propertyId: propertyA.id,
      name: "Tower A",
      code: "twr-a"
    });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyA.id, tenantId: TENANT_A },
      select: { id: true }
    });
    expect(prisma.building.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT_A,
        propertyId: propertyA.id,
        code: "TWR-A"
      })
    });
    expect(result.propertyId).toBe(propertyA.id);
  });

  it("rejects building creation when parent property is in another tenant", async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(
      service.createBuilding(TENANT_A, {
        propertyId: propertyB.id,
        name: "Foreign Tower",
        code: "FOR"
      })
    ).rejects.toThrow(NotFoundException);

    expect(prisma.building.create).not.toHaveBeenCalled();
  });

  it("creates a floor only when the parent building belongs to the same tenant", async () => {
    prisma.building.findFirst.mockResolvedValue({ id: buildingA.id });
    prisma.floor.create.mockResolvedValue(floorA);

    const result = await service.createFloor(TENANT_A, {
      buildingId: buildingA.id,
      name: "Level 1",
      levelNumber: 1
    });

    expect(prisma.building.findFirst).toHaveBeenCalledWith({
      where: { id: buildingA.id, tenantId: TENANT_A },
      select: { id: true }
    });
    expect(result.buildingId).toBe(buildingA.id);
  });

  it("rejects floor creation when parent building is in another tenant", async () => {
    prisma.building.findFirst.mockResolvedValue(null);

    await expect(
      service.createFloor(TENANT_A, {
        buildingId: "building-b",
        name: "Foreign Floor"
      })
    ).rejects.toThrow(NotFoundException);

    expect(prisma.floor.create).not.toHaveBeenCalled();
  });

  it("creates a room only when the parent floor belongs to the same tenant", async () => {
    prisma.floor.findFirst.mockResolvedValue({ id: floorA.id });
    prisma.room.create.mockResolvedValue(roomA);

    const result = await service.createRoom(TENANT_A, {
      floorId: floorA.id,
      name: "Room 101",
      code: "101",
      roomType: FacilityRoomType.OFFICE
    });

    expect(prisma.floor.findFirst).toHaveBeenCalledWith({
      where: { id: floorA.id, tenantId: TENANT_A },
      select: { id: true }
    });
    expect(result.floorId).toBe(floorA.id);
    expect(result.roomType).toBe(FacilityRoomType.OFFICE);
  });

  it("rejects room creation when parent floor is in another tenant", async () => {
    prisma.floor.findFirst.mockResolvedValue(null);

    await expect(
      service.createRoom(TENANT_A, {
        floorId: "floor-b",
        name: "Foreign Room"
      })
    ).rejects.toThrow(NotFoundException);

    expect(prisma.room.create).not.toHaveBeenCalled();
  });

  it("scopes property updates to the caller tenant", async () => {
    prisma.property.findFirst.mockResolvedValue(propertyA);
    prisma.property.update.mockResolvedValue({ ...propertyA, name: "Updated HQ" });

    const result = await service.updateProperty(TENANT_A, propertyA.id, { name: "Updated HQ" });

    expect(prisma.property.findFirst).toHaveBeenCalledWith({
      where: { id: propertyA.id, tenantId: TENANT_A }
    });
    expect(result.name).toBe("Updated HQ");
  });

  it("supports deactivation through PATCH isActive without delete routes", async () => {
    prisma.room.findFirst.mockResolvedValue(roomA);
    prisma.room.update.mockResolvedValue({ ...roomA, isActive: false });

    const result = await service.updateRoom(TENANT_A, roomA.id, { isActive: false });

    expect(prisma.room.update).toHaveBeenCalledWith({
      where: { id: roomA.id },
      data: { isActive: false }
    });
    expect(result.isActive).toBe(false);
  });

  it("maps public property responses without relation payloads", () => {
    const mapped = toPublicPropertyResponse(propertyA);

    expect(mapped).toEqual({
      id: propertyA.id,
      tenantId: TENANT_A,
      name: propertyA.name,
      code: propertyA.code,
      address: propertyA.address,
      isActive: true,
      createdAt: propertyA.createdAt.toISOString(),
      updatedAt: propertyA.updatedAt.toISOString()
    });
    expect(publicFacilityResponseHasSensitiveFields(mapped as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe("Facilities RBAC seed alignment", () => {
  it("grants manage only to FACILITY_MANAGER among facility roles", () => {
    const {
      BUILDING_SUPERVISOR_PERMISSIONS,
      FACILITY_MANAGER_PERMISSIONS
    } = require("../src/database/facility-seed.constants");

    expect(FACILITY_MANAGER_PERMISSIONS).toContain("facilities.manage");
    expect(BUILDING_SUPERVISOR_PERMISSIONS).not.toContain("facilities.manage");
    expect(BUILDING_SUPERVISOR_PERMISSIONS).toContain("facilities.view");
  });
});
