import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { WorkflowEngineService } from "./workflow-engine.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Workflow Engine")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("workflows")
export class WorkflowEngineController {
  constructor(private readonly workflows: WorkflowEngineService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR")
  @Permissions("admin.organization.manage")
  async list(@Req() req: AuthedRequest) {
    const data = await this.workflows.listDefinitions(req.user);
    return { data, message: "Workflow definitions" };
  }

  @Post("ensure-default")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async ensureDefault(@Req() req: AuthedRequest) {
    const data = await this.workflows.ensureDefaultWorkOrderWorkflow(req.user);
    return { data, message: "Default WO workflow ensured" };
  }

  @Post(":definitionId/publish")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.organization.manage")
  async publish(
    @Req() req: AuthedRequest,
    @Param("definitionId") definitionId: string,
    @Body() body: { reason?: string }
  ) {
    const data = await this.workflows.publishVersion(req.user, definitionId, {
      reason: body.reason
    });
    return { data, message: "Workflow version published" };
  }
}
