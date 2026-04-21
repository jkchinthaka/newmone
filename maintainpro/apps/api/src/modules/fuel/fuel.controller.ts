import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FuelService } from "./fuel.service";

@ApiTags("Fuel")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("fuel")
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "DRIVER", "SUPERVISOR")
  async logs() {
    const data = await this.fuelService.allLogs();
    return { data, message: "Fuel logs fetched" };
  }
}
