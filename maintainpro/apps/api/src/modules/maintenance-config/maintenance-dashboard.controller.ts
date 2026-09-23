import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceConfigService } from "./maintenance-config.service";

type AuthedRequest = { user: JwtPayload };

/**
 * D6 Maintenance Dashboard — operational read model.
 * Distinct from Action Center (/action-center). Does not mutate work-order state.
 */
@ApiTags("Maintenance Dashboard")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("maintenance")
export class MaintenanceDashboardController {
  constructor(private readonly config: MaintenanceConfigService) {}

  @Get("dashboard")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "OPERATIONS_MANAGER",
    "ASSET_MANAGER",
    "FLEET_MANAGER",
    "FACILITY_MANAGER",
    "BUILDING_SUPERVISOR",
    "SUPERVISOR",
    "MAINTENANCE_SUPERVISOR",
    "MECHANIC",
    "TECHNICIAN",
    "INVENTORY_KEEPER",
    "VIEWER"
  )
  async dashboard(@Req() req: AuthedRequest) {
    const data = await this.config.opsOverview(req.user);
    return { data, message: "Maintenance dashboard overview" };
  }
}
