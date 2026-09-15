import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { EvaluateKpisInput, ReportingKpisService } from "./reporting-kpis.service";

const ALL_REPORT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "MAINTENANCE_MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "FLEET_MANAGER",
  "SUPERVISOR",
  "MAINTENANCE_SUPERVISOR",
  "VIEWER",
  "AUDITOR",
  "FINANCE",
  "FINANCE_APPROVER",
  "COMPLIANCE_MANAGER"
] as const;

const HOME_ROLES = [
  ...ALL_REPORT_ROLES,
  "TECHNICIAN",
  "MECHANIC",
  "DRIVER",
  "SECURITY_OFFICER",
  "REQUESTER",
  "VENDOR"
] as const;

@ApiTags("Reporting KPIs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reporting-kpis")
export class ReportingKpisController {
  constructor(private readonly service: ReportingKpisService) {}

  /**
   * GET /reporting-kpis
   * Full KPI definition catalog with formula version.
   */
  @Get()
  @Roles(...ALL_REPORT_ROLES)
  @Permissions("reports.view")
  list() {
    return {
      data: this.service.listDefinitions(),
      message: "KPI definitions"
    };
  }

  /**
   * GET /reporting-kpis/home
   * Role-aware quick-action cards derived from the JWT role.
   * Must be declared before /:code to avoid being shadowed.
   */
  @Get("home")
  @Roles(...HOME_ROLES)
  roleHomeFromJwt(@Request() req: { user?: { role?: string } }) {
    const role = req.user?.role ?? "";
    return { data: this.service.resolveHome(role), message: "Role home" };
  }

  /**
   * GET /reporting-kpis/overview
   * Lightweight KPI counts for the authenticated tenant/role.
   * Accepts an optional JSON body for pre-aggregated inputs.
   */
  @Post("overview")
  @Roles(...ALL_REPORT_ROLES)
  @Permissions("reports.view")
  async overview(
    @Request() req: { user?: { tenantId?: string } },
    @Body() body: Partial<EvaluateKpisInput>
  ) {
    const tenantId = req.user?.tenantId ?? body.tenantId ?? "";
    const results = await this.service.evaluateKpis({ ...body, tenantId });
    return { data: results, message: "KPI overview" };
  }

  /**
   * GET /reporting-kpis/home/:role
   * Explicit role → cards (useful for admin impersonation / previewing).
   * Must be declared before /:code.
   */
  @Get("home/:role")
  @Roles(...HOME_ROLES)
  home(@Param("role") role: string) {
    return { data: this.service.resolveHome(role), message: "Role home" };
  }

  /**
   * GET /reporting-kpis/:code
   * Single KPI definition.
   */
  @Get(":code")
  @Roles(...ALL_REPORT_ROLES)
  @Permissions("reports.view")
  one(@Param("code") code: string) {
    const def = this.service.getDefinition(code);
    return {
      data: def ?? null,
      message: def ? def.formulaSummary : "Unknown KPI code"
    };
  }
}
