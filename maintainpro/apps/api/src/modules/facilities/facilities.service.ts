import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FacilityRoomType, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { CreateFloorDto } from "./dto/create-floor.dto";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateBuildingDto } from "./dto/update-building.dto";
import { UpdateFloorDto } from "./dto/update-floor.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import {
  toPublicBuildingResponse,
  toPublicFloorResponse,
  toPublicPropertyResponse,
  toPublicRoomResponse,
  type PublicBuildingResponse,
  type PublicFloorResponse,
  type PublicPropertyResponse,
  type PublicRoomResponse
} from "./facility-hierarchy.mapper";

type ListParams = {
  includeInactive?: boolean;
  q?: string;
};

@Injectable()
export class FacilitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private requireTenantId(tenantId: string | null | undefined): string {
    if (!tenantId) {
      throw new BadRequestException(
        "Tenant context is required. Select a tenant or provide X-Tenant-Id for cross-tenant administration."
      );
    }

    return tenantId;
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private searchFilter(q?: string): Prisma.PropertyWhereInput | undefined {
    const needle = q?.trim();
    if (!needle) {
      return undefined;
    }

    return {
      OR: [
        { name: { contains: needle, mode: "insensitive" } },
        { code: { contains: needle, mode: "insensitive" } },
        { address: { contains: needle, mode: "insensitive" } }
      ]
    };
  }

  private handleUniqueViolation(error: unknown, label: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new BadRequestException(`${label} code already exists for this tenant`);
    }

    throw error;
  }

  async listProperties(
    tenantId: string | null | undefined,
    params: ListParams = {}
  ): Promise<PublicPropertyResponse[]> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const rows = await this.prisma.property.findMany({
      where: {
        tenantId: scopedTenantId,
        isActive: params.includeInactive ? undefined : true,
        ...this.searchFilter(params.q)
      },
      orderBy: [{ name: "asc" }]
    });

    return rows.map(toPublicPropertyResponse);
  }

  async getProperty(tenantId: string | null | undefined, propertyId: string): Promise<PublicPropertyResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const row = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: scopedTenantId }
    });

    if (!row) {
      throw new NotFoundException("Property not found");
    }

    return toPublicPropertyResponse(row);
  }

  async createProperty(
    tenantId: string | null | undefined,
    input: CreatePropertyDto
  ): Promise<PublicPropertyResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);

    try {
      const row = await this.prisma.property.create({
        data: {
          tenantId: scopedTenantId,
          name: input.name.trim(),
          code: this.normalizeCode(input.code),
          address: input.address?.trim() || null
        }
      });

      return toPublicPropertyResponse(row);
    } catch (error) {
      this.handleUniqueViolation(error, "Property");
    }
  }

  async updateProperty(
    tenantId: string | null | undefined,
    propertyId: string,
    input: UpdatePropertyDto
  ): Promise<PublicPropertyResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const existing = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId: scopedTenantId }
    });

    if (!existing) {
      throw new NotFoundException("Property not found");
    }

    const data: Prisma.PropertyUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.code !== undefined) {
      data.code = this.normalizeCode(input.code);
    }

    if (input.address !== undefined) {
      data.address = input.address.trim() || null;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    try {
      const row = await this.prisma.property.update({
        where: { id: propertyId },
        data
      });

      return toPublicPropertyResponse(row);
    } catch (error) {
      this.handleUniqueViolation(error, "Property");
    }
  }

  async listBuildings(
    tenantId: string | null | undefined,
    params: ListParams & { propertyId?: string } = {}
  ): Promise<PublicBuildingResponse[]> {
    const scopedTenantId = this.requireTenantId(tenantId);

    if (params.propertyId) {
      await this.assertPropertyInTenant(scopedTenantId, params.propertyId);
    }

    const rows = await this.prisma.building.findMany({
      where: {
        tenantId: scopedTenantId,
        propertyId: params.propertyId,
        isActive: params.includeInactive ? undefined : true,
        ...(params.q?.trim()
          ? {
              OR: [
                { name: { contains: params.q.trim(), mode: "insensitive" } },
                { code: { contains: params.q.trim(), mode: "insensitive" } },
                { description: { contains: params.q.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }]
    });

    return rows.map(toPublicBuildingResponse);
  }

  async getBuilding(tenantId: string | null | undefined, buildingId: string): Promise<PublicBuildingResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const row = await this.prisma.building.findFirst({
      where: { id: buildingId, tenantId: scopedTenantId }
    });

    if (!row) {
      throw new NotFoundException("Building not found");
    }

    return toPublicBuildingResponse(row);
  }

  async createBuilding(
    tenantId: string | null | undefined,
    input: CreateBuildingDto
  ): Promise<PublicBuildingResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    await this.assertPropertyInTenant(scopedTenantId, input.propertyId);

    try {
      const row = await this.prisma.building.create({
        data: {
          tenantId: scopedTenantId,
          propertyId: input.propertyId,
          name: input.name.trim(),
          code: this.normalizeCode(input.code),
          description: input.description?.trim() || null
        }
      });

      return toPublicBuildingResponse(row);
    } catch (error) {
      this.handleUniqueViolation(error, "Building");
    }
  }

  async updateBuilding(
    tenantId: string | null | undefined,
    buildingId: string,
    input: UpdateBuildingDto
  ): Promise<PublicBuildingResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const existing = await this.prisma.building.findFirst({
      where: { id: buildingId, tenantId: scopedTenantId }
    });

    if (!existing) {
      throw new NotFoundException("Building not found");
    }

    const data: Prisma.BuildingUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.code !== undefined) {
      data.code = this.normalizeCode(input.code);
    }

    if (input.description !== undefined) {
      data.description = input.description.trim() || null;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    try {
      const row = await this.prisma.building.update({
        where: { id: buildingId },
        data
      });

      return toPublicBuildingResponse(row);
    } catch (error) {
      this.handleUniqueViolation(error, "Building");
    }
  }

  async listFloors(
    tenantId: string | null | undefined,
    params: ListParams & { buildingId?: string } = {}
  ): Promise<PublicFloorResponse[]> {
    const scopedTenantId = this.requireTenantId(tenantId);

    if (params.buildingId) {
      await this.assertBuildingInTenant(scopedTenantId, params.buildingId);
    }

    const rows = await this.prisma.floor.findMany({
      where: {
        tenantId: scopedTenantId,
        buildingId: params.buildingId,
        isActive: params.includeInactive ? undefined : true,
        ...(params.q?.trim()
          ? {
              OR: [{ name: { contains: params.q.trim(), mode: "insensitive" } }]
            }
          : {})
      },
      orderBy: [{ levelNumber: "asc" }, { name: "asc" }]
    });

    return rows.map(toPublicFloorResponse);
  }

  async getFloor(tenantId: string | null | undefined, floorId: string): Promise<PublicFloorResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const row = await this.prisma.floor.findFirst({
      where: { id: floorId, tenantId: scopedTenantId }
    });

    if (!row) {
      throw new NotFoundException("Floor not found");
    }

    return toPublicFloorResponse(row);
  }

  async createFloor(
    tenantId: string | null | undefined,
    input: CreateFloorDto
  ): Promise<PublicFloorResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    await this.assertBuildingInTenant(scopedTenantId, input.buildingId);

    const row = await this.prisma.floor.create({
      data: {
        tenantId: scopedTenantId,
        buildingId: input.buildingId,
        name: input.name.trim(),
        levelNumber: input.levelNumber ?? null
      }
    });

    return toPublicFloorResponse(row);
  }

  async updateFloor(
    tenantId: string | null | undefined,
    floorId: string,
    input: UpdateFloorDto
  ): Promise<PublicFloorResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const existing = await this.prisma.floor.findFirst({
      where: { id: floorId, tenantId: scopedTenantId }
    });

    if (!existing) {
      throw new NotFoundException("Floor not found");
    }

    const data: Prisma.FloorUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.levelNumber !== undefined) {
      data.levelNumber = input.levelNumber;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const row = await this.prisma.floor.update({
      where: { id: floorId },
      data
    });

    return toPublicFloorResponse(row);
  }

  async listRooms(
    tenantId: string | null | undefined,
    params: ListParams & { floorId?: string } = {}
  ): Promise<PublicRoomResponse[]> {
    const scopedTenantId = this.requireTenantId(tenantId);

    if (params.floorId) {
      await this.assertFloorInTenant(scopedTenantId, params.floorId);
    }

    const rows = await this.prisma.room.findMany({
      where: {
        tenantId: scopedTenantId,
        floorId: params.floorId,
        isActive: params.includeInactive ? undefined : true,
        ...(params.q?.trim()
          ? {
              OR: [
                { name: { contains: params.q.trim(), mode: "insensitive" } },
                { code: { contains: params.q.trim(), mode: "insensitive" } }
              ]
            }
          : {})
      },
      orderBy: [{ name: "asc" }]
    });

    return rows.map(toPublicRoomResponse);
  }

  async getRoom(tenantId: string | null | undefined, roomId: string): Promise<PublicRoomResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const row = await this.prisma.room.findFirst({
      where: { id: roomId, tenantId: scopedTenantId }
    });

    if (!row) {
      throw new NotFoundException("Room not found");
    }

    return toPublicRoomResponse(row);
  }

  async createRoom(
    tenantId: string | null | undefined,
    input: CreateRoomDto
  ): Promise<PublicRoomResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    await this.assertFloorInTenant(scopedTenantId, input.floorId);

    const row = await this.prisma.room.create({
      data: {
        tenantId: scopedTenantId,
        floorId: input.floorId,
        name: input.name.trim(),
        code: input.code?.trim() || null,
        roomType: input.roomType ?? null
      }
    });

    return toPublicRoomResponse(row);
  }

  async updateRoom(
    tenantId: string | null | undefined,
    roomId: string,
    input: UpdateRoomDto
  ): Promise<PublicRoomResponse> {
    const scopedTenantId = this.requireTenantId(tenantId);
    const existing = await this.prisma.room.findFirst({
      where: { id: roomId, tenantId: scopedTenantId }
    });

    if (!existing) {
      throw new NotFoundException("Room not found");
    }

    const data: Prisma.RoomUpdateInput = {};

    if (input.name !== undefined) {
      data.name = input.name.trim();
    }

    if (input.code !== undefined) {
      data.code = input.code.trim() || null;
    }

    if (input.roomType !== undefined) {
      data.roomType = input.roomType as FacilityRoomType;
    }

    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const row = await this.prisma.room.update({
      where: { id: roomId },
      data
    });

    return toPublicRoomResponse(row);
  }

  private async assertPropertyInTenant(tenantId: string, propertyId: string): Promise<void> {
    const row = await this.prisma.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true }
    });

    if (!row) {
      throw new NotFoundException("Property not found");
    }
  }

  private async assertBuildingInTenant(tenantId: string, buildingId: string): Promise<void> {
    const row = await this.prisma.building.findFirst({
      where: { id: buildingId, tenantId },
      select: { id: true }
    });

    if (!row) {
      throw new NotFoundException("Building not found");
    }
  }

  private async assertFloorInTenant(tenantId: string, floorId: string): Promise<void> {
    const row = await this.prisma.floor.findFirst({
      where: { id: floorId, tenantId },
      select: { id: true }
    });

    if (!row) {
      throw new NotFoundException("Floor not found");
    }
  }
}
