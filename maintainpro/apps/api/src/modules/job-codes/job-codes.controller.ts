import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { JobCodesService } from "./job-codes.service";

type AuthedRequest = {
  user: JwtPayload;
};

@ApiTags("Job Codes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("job-codes")
export class JobCodesController {
  constructor(private readonly jobCodesService: JobCodesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "TECHNICIAN")
  async findAll(
    @Req() req: AuthedRequest,
    @Query("q") q?: string,
    @Query("pageSize") pageSize?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.jobCodesService.findAll(req.user?.tenantId ?? null, {
      q,
      pageSize: pageSize ? Number(pageSize) : undefined,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Job codes fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { code?: string; name?: string; description?: string; category?: string }
  ) {
    const code = body.code?.trim();
    const name = body.name?.trim();
    if (!code) throw new BadRequestException("`code` is required");
    if (!name) throw new BadRequestException("`name` is required");

    const data = await this.jobCodesService.create(req.user?.tenantId ?? null, {
      code,
      name,
      description: body.description,
      category: body.category
    });
    return { data, message: "Job code created" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.jobCodesService.remove(req.user?.tenantId ?? null, id);
    return { data, message: "Job code deleted" };
  }
}
