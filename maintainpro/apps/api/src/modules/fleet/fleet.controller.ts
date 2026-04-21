import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FleetService } from "./fleet.service";

@ApiTags("Fleet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("fleet")
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Get("live-map")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async liveMap() {
    const data = await this.fleetService.liveMap();
    return { data, message: "Live fleet map fetched" };
  }
}
