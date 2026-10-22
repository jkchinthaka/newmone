import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { TripsService } from "./trips.service";

@ApiTags("Trips")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("trips")
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER", "SUPERVISOR")
  async allTrips() {
    const data = await this.tripsService.allTrips();
    return { data, message: "Trips fetched" };
  }
}
