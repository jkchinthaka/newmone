import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceConfigService } from "./maintenance-config.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Maintenance Config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/maintenance-config")
export class MaintenanceConfigController {
  constructor(private readonly config: MaintenanceConfigService) {}

  @Get("overview")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("admin.overview.view")
  async overview(@Req() req: AuthedRequest) {
    const data = await this.config.opsOverview(req.user);
    return { data, message: "Maintenance operations overview" };
  }

  @Get("job-categories")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("admin.organization.manage")
  async listCategories(@Req() req: AuthedRequest, @Query("jobDomain") jobDomain?: string) {
    const data = await this.config.listJobCategories(req.user, jobDomain);
    return { data, message: "Job categories" };
  }

  @Post("job-categories")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async createCategory(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      jobDomain: string;
      level: "MAIN" | "SUB";
      code: string;
      name: string;
      parentId?: string;
      sortOrder?: number;
    }
  ) {
    const data = await this.config.createJobCategory(req.user, body);
    return { data, message: "Job category created" };
  }

  @Patch("job-categories/:id")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async updateCategory(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: {
      name?: string;
      active?: boolean;
      sortOrder?: number;
      parentId?: string | null;
    }
  ) {
    const data = await this.config.updateJobCategory(req.user, id, body);
    return { data, message: "Job category updated" };
  }

  @Post("job-categories/seed-defaults")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async seedDefaults(@Req() req: AuthedRequest) {
    const data = await this.config.seedDefaultCategories(req.user);
    return { data, message: "Default job categories seeded" };
  }

  @Get("priority-sla")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("admin.organization.manage")
  async listPrioritySla(@Req() req: AuthedRequest) {
    const data = await this.config.listPrioritySla(req.user);
    return { data, message: "Priority SLA rules" };
  }

  @Post("priority-sla")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async upsertPrioritySla(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      priority: string;
      responseMinutes?: number | null;
      completionMinutes?: number | null;
      escalateOnBreach?: boolean;
      notifyOnBreach?: boolean;
      active?: boolean;
    }
  ) {
    if (!body.priority?.trim()) {
      throw new BadRequestException("priority is required");
    }
    const data = await this.config.upsertPrioritySla(req.user, body);
    return { data, message: "Priority SLA rule saved" };
  }

  @Get("integrations-status")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.system.view")
  integrationsStatus() {
    const data = this.config.integrationsStatus();
    return { data, message: "Integration readiness" };
  }
}
