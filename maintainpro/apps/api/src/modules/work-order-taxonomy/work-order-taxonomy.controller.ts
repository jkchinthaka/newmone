import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { WorkOrderTaxonomyLevel } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { WorkOrderTaxonomyService, type UpsertTaxonomyInput } from "./work-order-taxonomy.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Work Order Taxonomy")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("work-orders/taxonomy")
export class WorkOrderTaxonomyController {
  constructor(private readonly taxonomyService: WorkOrderTaxonomyService) {}

  @Get("suggest")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async suggest(@Req() req: AuthedRequest, @Query("q") q = "") {
    const data = await this.taxonomyService.suggest(req.user, q);
    return { data, message: "Work order taxonomy suggestion fetched" };
  }

  @Get("search")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "MECHANIC",
    "TECHNICIAN",
    "SUPERVISOR",
    "INVENTORY_KEEPER",
    "SECURITY_OFFICER"
  )
  async search(@Req() req: AuthedRequest, @Query("q") q = "", @Query("limit") limit?: string) {
    const data = await this.taxonomyService.search(req.user, q, limit ? Number(limit) : 25);
    return { data, message: "Work order taxonomy search results fetched" };
  }

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR")
  async list(
    @Req() req: AuthedRequest,
    @Query("includeInactive") includeInactive?: string,
    @Query("level") level?: WorkOrderTaxonomyLevel,
    @Query("parentId") parentId?: string
  ) {
    const data = await this.taxonomyService.list(req.user, {
      includeInactive: includeInactive === "true",
      level,
      parentId
    });
    return { data, message: "Work order taxonomy fetched" };
  }

  @Get(":id/usage")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  async usage(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.taxonomyService.getUsage(req.user, id);
    return { data, message: "Work order taxonomy usage fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN")
  async create(@Req() req: AuthedRequest, @Body() body: UpsertTaxonomyInput) {
    const data = await this.taxonomyService.create(req.user, body);
    return { data, message: "Work order taxonomy entry created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Partial<UpsertTaxonomyInput>) {
    const data = await this.taxonomyService.update(req.user, id, body);
    return { data, message: "Work order taxonomy entry updated" };
  }

  @Patch(":id/deactivate")
  @Roles("SUPER_ADMIN", "ADMIN")
  async deactivate(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.taxonomyService.deactivate(req.user, id);
    return { data, message: "Work order taxonomy entry deactivated" };
  }
}
