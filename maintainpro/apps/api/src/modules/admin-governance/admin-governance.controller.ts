import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { AdminGovernanceService } from "./admin-governance.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Admin Governance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("admin-governance")
export class AdminGovernanceController {
  constructor(private readonly governance: AdminGovernanceService) {}

  @Get("sections")
  @Roles("SUPER_ADMIN", "ADMIN")
  sections(@Req() req: AuthedRequest) {
    const includeTechnical = req.user.role === "SUPER_ADMIN" || req.user.role === "ADMIN";
    return {
      data: this.governance.listSections(includeTechnical),
      message: "Maintenance admin sections"
    };
  }

  @Get("users/:id/deactivate-preview")
  @Roles("SUPER_ADMIN", "ADMIN")
  async deactivatePreview(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.governance.previewDeactivate(req.user, id);
    return { data, message: data.code };
  }

  @Post("config-change/guard")
  @Roles("SUPER_ADMIN", "ADMIN")
  configGuard(@Body() body: any) {
    const data = this.governance.guardConfigChange(body);
    return { data, message: data.code };
  }

  @Get("data-quality")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async dataQuality(@Req() req: AuthedRequest) {
    const data = await this.governance.dataQualityOverview(req.user);
    return { data, message: "Data quality overview" };
  }
}
