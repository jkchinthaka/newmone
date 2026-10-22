import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { AdminGovernanceService } from "./admin-governance.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Admin Governance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("admin-governance")
export class AdminGovernanceController {
  constructor(private readonly governance: AdminGovernanceService) {}

  @Get("overview")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.overview.view")
  async overview(@Req() req: AuthedRequest) {
    const data = await this.governance.overview(req.user);
    return { data, message: "Admin overview" };
  }

  @Get("users/:id/deactivate-preview")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.users.manage")
  async deactivatePreview(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.governance.previewDeactivate(req.user, id);
    return { data, message: data.code };
  }

  @Post("config-change/guard")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.system.view")
  configGuard(@Body() body: { confirmed: boolean; impactPreviewProvided: boolean; reason?: string; effectiveFrom?: string }) {
    const data = this.governance.guardConfigChange(body);
    return { data, message: data.code };
  }

  @Get("data-quality")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("admin.dataquality.view")
  async dataQuality(@Req() req: AuthedRequest) {
    const data = await this.governance.dataQualityIssues(req.user);
    return { data, message: "Data quality issues" };
  }

  @Get("system")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("admin.system.view")
  system() {
    const data = this.governance.systemInfo();
    return { data, message: "System info" };
  }
}
