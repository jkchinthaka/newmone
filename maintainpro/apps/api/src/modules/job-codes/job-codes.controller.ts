import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

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
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "parentId", required: false, description: "Pass 'null' for main jobs, or an ObjectId for sub-jobs of that parent" })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  async findAll(
    @Req() req: AuthedRequest,
    @Query("q") q?: string,
    @Query("parentId") parentId?: string,
    @Query("pageSize") pageSize?: string,
    @Query("includeInactive") includeInactive?: string
  ) {
    const data = await this.jobCodesService.findAll(req.user?.tenantId ?? null, {
      q,
      parentId,
      pageSize: pageSize ? Number(pageSize) : undefined,
      includeInactive: includeInactive === "true"
    });
    return { data, message: "Job codes fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.jobCodesService.findOne(req.user?.tenantId ?? null, id);
    return { data, message: "Job code fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      code?: string;
      name?: string;
      description?: string;
      category?: string;
      parentId?: string | null;
      estimatedHours?: number | null;
      requiredSkills?: string[];
      requiredPartIds?: string[];
    }
  ) {
    const code = body.code?.trim();
    const name = body.name?.trim();
    if (!code) throw new BadRequestException("`code` is required");
    if (!name) throw new BadRequestException("`name` is required");

    const data = await this.jobCodesService.create(req.user?.tenantId ?? null, {
      code,
      name,
      description: body.description,
      category: body.category,
      parentId: body.parentId || null,
      estimatedHours: body.estimatedHours,
      requiredSkills: body.requiredSkills,
      requiredPartIds: body.requiredPartIds
    });
    return { data, message: "Job code created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      code?: string;
      name?: string;
      description?: string;
      category?: string;
      parentId?: string | null;
      estimatedHours?: number | null;
      requiredSkills?: string[];
      requiredPartIds?: string[];
      isActive?: boolean;
    }
  ) {
    const data = await this.jobCodesService.update(req.user?.tenantId ?? null, id, body);
    return { data, message: "Job code updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.jobCodesService.remove(req.user?.tenantId ?? null, id);
    return { data, message: "Job code deactivated" };
  }
}

