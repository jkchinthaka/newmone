import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MasterListsService } from "./master-lists.service";

type AuthedRequest = { user: JwtPayload };
const READ = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER", "MECHANIC", "TECHNICIAN", "VIEWER"] as const;
const MANAGE = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER"] as const;

@ApiTags("Master data")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("master-data")
export class MasterListsController {
  constructor(private readonly service: MasterListsService) {}

  @Get("work-calendar")
  @Roles(...READ)
  async calendar(@Req() req: AuthedRequest) {
    return { data: await this.service.calendar(req.user?.tenantId ?? null), message: "Work calendar fetched" };
  }

  @Post("work-calendar")
  @Roles(...MANAGE)
  async createCalendar(@Req() req: AuthedRequest, @Body() body: { kind: string; name: string; date?: string; startTime?: string; endTime?: string }) {
    return { data: await this.service.createCalendar(req.user?.tenantId ?? null, body), message: "Calendar entry added" };
  }

  @Delete("work-calendar/:id")
  @Roles(...MANAGE)
  async removeCalendar(@Req() req: AuthedRequest, @Param("id") id: string) {
    return { data: await this.service.removeCalendar(req.user?.tenantId ?? null, id), message: "Calendar entry removed" };
  }

  @Get("lists/:kind")
  @Roles(...READ)
  async list(@Req() req: AuthedRequest, @Param("kind") kind: string, @Query("includeInactive") includeInactive?: string) {
    return { data: await this.service.list(req.user?.tenantId ?? null, kind, includeInactive === "true"), message: "List fetched" };
  }

  @Post("lists/:kind")
  @Roles(...MANAGE)
  async create(@Req() req: AuthedRequest, @Param("kind") kind: string, @Body() body: { name: string; code?: string | null }) {
    return { data: await this.service.create(req.user?.tenantId ?? null, kind, body), message: "Item added" };
  }

  @Patch("lists/:kind/:id")
  @Roles(...MANAGE)
  async update(@Req() req: AuthedRequest, @Param("kind") kind: string, @Param("id") id: string, @Body() body: { name?: string; code?: string | null; isActive?: boolean }) {
    return { data: await this.service.update(req.user?.tenantId ?? null, kind, id, body), message: "Item updated" };
  }
}
