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
import { MaintenanceTemplatesService } from "./maintenance-templates.service";
import { TenantFeaturesService } from "./tenant-features.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Maintenance Config")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin/maintenance-config")
export class MaintenanceConfigController {
  constructor(
    private readonly config: MaintenanceConfigService,
    private readonly features: TenantFeaturesService,
    private readonly templates: MaintenanceTemplatesService
  ) {}

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
      reason?: string;
    }
  ) {
    if (!body.priority?.trim()) {
      throw new BadRequestException("priority is required");
    }
    const data = await this.config.upsertPrioritySla(req.user, body);
    return { data, message: "Priority SLA rule saved" };
  }

  @Get("analysis-codes")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTENANCE_SUPERVISOR", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  @Permissions("work_orders.complete")
  async listAnalysisCodes(@Req() req: AuthedRequest, @Query("kind") kind?: string) {
    const data = await this.config.listAnalysisCodes(req.user, kind);
    return { data, message: "Analysis codes" };
  }

  @Post("analysis-codes")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async upsertAnalysisCode(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      kind: string;
      code: string;
      name: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      reason?: string;
    }
  ) {
    const data = await this.config.upsertAnalysisCode(req.user, body);
    return { data, message: "Analysis code saved" };
  }

  @Get("reason-codes")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "MAINTENANCE_SUPERVISOR", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  @Permissions("work_orders.hold")
  async listReasonCodes(@Req() req: AuthedRequest, @Query("kind") kind?: string) {
    const data = await this.config.listReasonCodes(req.user, kind);
    return { data, message: "Reason codes" };
  }

  @Post("reason-codes")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async upsertReasonCode(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      kind: string;
      code: string;
      name: string;
      description?: string;
      requiresNotes?: boolean;
      sortOrder?: number;
      active?: boolean;
      reason?: string;
    }
  ) {
    const data = await this.config.upsertReasonCode(req.user, body);
    return { data, message: "Reason code saved" };
  }

  @Get("config-history")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR")
  @Permissions("admin.audit.view")
  async configHistory(
    @Req() req: AuthedRequest,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("limit") limit?: string
  ) {
    const data = await this.config.listConfigHistory(req.user, {
      entityType,
      entityId,
      limit: limit ? Number(limit) : undefined
    });
    return { data, message: "Configuration change history" };
  }

  @Get("integrations-status")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.system.view")
  integrationsStatus() {
    const data = this.config.integrationsStatus();
    return { data, message: "Integration readiness" };
  }

  @Get("feature-flags")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER")
  @Permissions("admin.overview.view")
  async listFeatureFlags(@Req() req: AuthedRequest) {
    const data = await this.features.listForTenant(req.user);
    return { data, message: "Tenant feature flags" };
  }

  @Post("feature-flags")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.features.manage")
  async upsertFeatureFlag(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      code: string;
      enabled: boolean;
      name?: string;
      description?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      configJson?: unknown;
      reason?: string;
    }
  ) {
    if (!body.code?.trim() || typeof body.enabled !== "boolean") {
      throw new BadRequestException("code and enabled are required");
    }
    const data = await this.features.upsert(req.user, body);
    return { data, message: "Feature flag saved" };
  }

  @Get("maintenance-templates")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN")
  @Permissions("planning.view")
  async listTemplates(
    @Req() req: AuthedRequest,
    @Query("jobDomain") jobDomain?: string,
    @Query("activeOnly") activeOnly?: string
  ) {
    const data = await this.templates.list(req.user, {
      jobDomain,
      activeOnly: activeOnly === "false" ? false : true
    });
    return { data, message: "Maintenance templates" };
  }

  @Post("maintenance-templates")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("maintenance.templates.manage")
  async createTemplate(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.templates.create(req.user, body as never);
    return { data, message: "Maintenance template created" };
  }

  @Post("maintenance-templates/seed-defaults")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("maintenance.templates.manage")
  async seedTemplates(@Req() req: AuthedRequest) {
    const data = await this.templates.seedDefaults(req.user);
    return { data, message: "Default maintenance templates seeded" };
  }

  @Post("maintenance-templates/:id/revise")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("maintenance.templates.manage")
  async reviseTemplate(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.templates.revise(req.user, id, body as never);
    return { data, message: "Maintenance template revised" };
  }

  @Post("maintenance-templates/:id/active")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("maintenance.templates.manage")
  async setTemplateActive(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { active: boolean; reason?: string }
  ) {
    if (typeof body.active !== "boolean") {
      throw new BadRequestException("active is required");
    }
    const data = await this.templates.setActive(req.user, id, body.active, body.reason);
    return { data, message: "Maintenance template status updated" };
  }
}
