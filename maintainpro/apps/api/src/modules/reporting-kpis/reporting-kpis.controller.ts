import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import {
  getKpiDefinition,
  KPI_DEFINITIONS,
  KPI_FORMULA_VERSION
} from "./kpi-definitions";
import { resolveRoleHome } from "./role-home";

@ApiTags("Reporting KPIs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reporting-kpis")
export class ReportingKpisController {
  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER", "ASSET_MANAGER", "FLEET_MANAGER")
  list() {
    return {
      data: { version: KPI_FORMULA_VERSION, definitions: KPI_DEFINITIONS },
      message: "KPI definitions"
    };
  }

  @Get("home/:role")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "VIEWER",
    "ASSET_MANAGER",
    "FLEET_MANAGER",
    "TECHNICIAN",
    "MECHANIC",
    "SUPERVISOR",
    "DRIVER",
    "SECURITY_OFFICER"
  )
  home(@Param("role") role: string) {
    return { data: resolveRoleHome(role), message: "Role home" };
  }

  @Get(":key")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER", "ASSET_MANAGER", "FLEET_MANAGER")
  one(@Param("key") key: string) {
    const def = getKpiDefinition(key.toUpperCase());
    return {
      data: def ?? null,
      message: def ? def.help : "Unknown KPI"
    };
  }
}
