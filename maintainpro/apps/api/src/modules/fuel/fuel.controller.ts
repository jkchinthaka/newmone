import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { FuelService } from "./fuel.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Fuel")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("fuel")
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "DRIVER", "VIEWER")
  async logs(@Req() req: AuthedRequest) {
    const data = await this.fuelService.allLogs(req.user);
    return { data, message: "Fuel logs fetched" };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "DRIVER", "VIEWER")
  async analytics(@Req() req: AuthedRequest) {
    const data = await this.fuelService.analytics(req.user);
    return { data, message: "Fuel analytics fetched" };
  }
}
