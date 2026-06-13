import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { CreateBuildingDto } from "./dto/create-building.dto";
import { CreateFloorDto } from "./dto/create-floor.dto";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateBuildingDto } from "./dto/update-building.dto";
import { UpdateFloorDto } from "./dto/update-floor.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { FacilitiesService } from "./facilities.service";

type AuthedRequest = {
  user: JwtPayload;
};

const FACILITY_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "SUPERVISOR",
  "VIEWER"
] as const;

const FACILITY_MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "FACILITY_MANAGER"] as const;

@ApiTags("Facilities")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("facilities")
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get("dashboard")
  @Header("Cache-Control", "private, max-age=15")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  async getDashboard(@Req() req: AuthedRequest) {
    const data = await this.facilitiesService.getDashboardSummary(req.user.tenantId ?? null);
    return { data, message: "Facility dashboard summary fetched" };
  }

  @Get("properties")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async listProperties(
    @Req() req: AuthedRequest,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.facilitiesService.listProperties(req.user.tenantId ?? null, {
      q,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Properties fetched" };
  }

  @Post("properties")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async createProperty(@Req() req: AuthedRequest, @Body() body: CreatePropertyDto) {
    const data = await this.facilitiesService.createProperty(req.user.tenantId ?? null, body);
    return { data, message: "Property created" };
  }

  @Get("properties/:propertyId")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  async getProperty(@Req() req: AuthedRequest, @Param("propertyId") propertyId: string) {
    const data = await this.facilitiesService.getProperty(req.user.tenantId ?? null, propertyId);
    return { data, message: "Property fetched" };
  }

  @Patch("properties/:propertyId")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async updateProperty(
    @Req() req: AuthedRequest,
    @Param("propertyId") propertyId: string,
    @Body() body: UpdatePropertyDto
  ) {
    const data = await this.facilitiesService.updateProperty(req.user.tenantId ?? null, propertyId, body);
    return { data, message: "Property updated" };
  }

  @Get("buildings")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  @ApiQuery({ name: "propertyId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async listBuildings(
    @Req() req: AuthedRequest,
    @Query("propertyId") propertyId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.facilitiesService.listBuildings(req.user.tenantId ?? null, {
      propertyId,
      q,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Buildings fetched" };
  }

  @Post("buildings")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async createBuilding(@Req() req: AuthedRequest, @Body() body: CreateBuildingDto) {
    const data = await this.facilitiesService.createBuilding(req.user.tenantId ?? null, body);
    return { data, message: "Building created" };
  }

  @Get("buildings/:buildingId")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  async getBuilding(@Req() req: AuthedRequest, @Param("buildingId") buildingId: string) {
    const data = await this.facilitiesService.getBuilding(req.user.tenantId ?? null, buildingId);
    return { data, message: "Building fetched" };
  }

  @Patch("buildings/:buildingId")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async updateBuilding(
    @Req() req: AuthedRequest,
    @Param("buildingId") buildingId: string,
    @Body() body: UpdateBuildingDto
  ) {
    const data = await this.facilitiesService.updateBuilding(req.user.tenantId ?? null, buildingId, body);
    return { data, message: "Building updated" };
  }

  @Get("floors")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  @ApiQuery({ name: "buildingId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async listFloors(
    @Req() req: AuthedRequest,
    @Query("buildingId") buildingId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.facilitiesService.listFloors(req.user.tenantId ?? null, {
      buildingId,
      q,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Floors fetched" };
  }

  @Post("floors")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async createFloor(@Req() req: AuthedRequest, @Body() body: CreateFloorDto) {
    const data = await this.facilitiesService.createFloor(req.user.tenantId ?? null, body);
    return { data, message: "Floor created" };
  }

  @Get("floors/:floorId")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  async getFloor(@Req() req: AuthedRequest, @Param("floorId") floorId: string) {
    const data = await this.facilitiesService.getFloor(req.user.tenantId ?? null, floorId);
    return { data, message: "Floor fetched" };
  }

  @Patch("floors/:floorId")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async updateFloor(
    @Req() req: AuthedRequest,
    @Param("floorId") floorId: string,
    @Body() body: UpdateFloorDto
  ) {
    const data = await this.facilitiesService.updateFloor(req.user.tenantId ?? null, floorId, body);
    return { data, message: "Floor updated" };
  }

  @Get("rooms")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  @ApiQuery({ name: "floorId", required: false })
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async listRooms(
    @Req() req: AuthedRequest,
    @Query("floorId") floorId?: string,
    @Query("q") q?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.facilitiesService.listRooms(req.user.tenantId ?? null, {
      floorId,
      q,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Rooms fetched" };
  }

  @Post("rooms")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async createRoom(@Req() req: AuthedRequest, @Body() body: CreateRoomDto) {
    const data = await this.facilitiesService.createRoom(req.user.tenantId ?? null, body);
    return { data, message: "Room created" };
  }

  @Get("rooms/:roomId")
  @Header("Cache-Control", "private, max-age=30")
  @Roles(...FACILITY_READ_ROLES)
  @Permissions("facilities.view")
  async getRoom(@Req() req: AuthedRequest, @Param("roomId") roomId: string) {
    const data = await this.facilitiesService.getRoom(req.user.tenantId ?? null, roomId);
    return { data, message: "Room fetched" };
  }

  @Patch("rooms/:roomId")
  @Roles(...FACILITY_MANAGE_ROLES)
  @Permissions("facilities.manage")
  async updateRoom(
    @Req() req: AuthedRequest,
    @Param("roomId") roomId: string,
    @Body() body: UpdateRoomDto
  ) {
    const data = await this.facilitiesService.updateRoom(req.user.tenantId ?? null, roomId, body);
    return { data, message: "Room updated" };
  }
}
