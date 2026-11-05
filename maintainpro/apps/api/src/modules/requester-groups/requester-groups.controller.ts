import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { RequesterGroupsService } from "./requester-groups.service";

type AuthedRequest = { user: JwtPayload };
const READ = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER", "MECHANIC", "TECHNICIAN", "VIEWER"] as const;
const MANAGE = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER"] as const;

@ApiTags("Master data")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("master-data")
export class RequesterGroupsController {
  constructor(private readonly service: RequesterGroupsService) {}

  @Get("requester-groups")
  @Roles(...READ)
  async groups(@Req() req: AuthedRequest, @Query("includeInactive") includeInactive?: string, @Query("q") q?: string) {
    return { data: await this.service.listGroups(req.user?.tenantId ?? null, includeInactive === "true", q), message: "Requester groups fetched" };
  }

  @Post("requester-groups")
  @Roles(...MANAGE)
  async createGroup(@Req() req: AuthedRequest, @Body() body: { name: string; description?: string; departmentId?: string | null; memberIds?: string[] }) {
    return { data: await this.service.createGroup(req.user?.tenantId ?? null, body), message: "Requester group created" };
  }

  @Patch("requester-groups/:id")
  @Roles(...MANAGE)
  async updateGroup(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { name?: string; description?: string; departmentId?: string | null; isActive?: boolean; memberIds?: string[] }) {
    return { data: await this.service.updateGroup(req.user?.tenantId ?? null, id, body), message: "Requester group updated" };
  }

  @Get("requester-groups/by-code/:code")
  @Roles(...READ)
  async groupByCode(@Req() req: AuthedRequest, @Param("code") code: string) {
    return { data: await this.service.groupByCode(req.user?.tenantId ?? null, code), message: "Requester group fetched" };
  }

  @Get("part-categories/by-code/:code")
  @Roles(...READ)
  async partCategoryByCode(@Req() req: AuthedRequest, @Param("code") code: string) {
    return { data: await this.service.partCategoryByCode(req.user?.tenantId ?? null, code), message: "Category fetched" };
  }

  @Get("part-categories")
  @Roles(...READ)
  async partCategories(@Req() req: AuthedRequest, @Query("includeInactive") includeInactive?: string, @Query("q") q?: string) {
    return { data: await this.service.listPartCategories(req.user?.tenantId ?? null, includeInactive === "true", q), message: "Spare part categories fetched" };
  }

  @Post("part-categories")
  @Roles(...MANAGE)
  async createPartCategory(@Req() req: AuthedRequest, @Body() body: { name: string }) {
    return { data: await this.service.createPartCategory(req.user?.tenantId ?? null, body), message: "Category created" };
  }

  @Patch("part-categories/:id")
  @Roles(...MANAGE)
  async updatePartCategory(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: { name?: string; isActive?: boolean }) {
    return { data: await this.service.updatePartCategory(req.user?.tenantId ?? null, id, body), message: "Category updated" };
  }
}
