import { Controller, Get, Inject, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { FleetService } from "./fleet.service";

@ApiTags("Fleet")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("fleet")
export class FleetController {
  constructor(
    @Inject(FleetService)
    private readonly fleetService: FleetService
  ) {}

  @Get("live-map")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async liveMap() {
    const data = await this.fleetService.liveMap();
    return { data, message: "Live fleet map fetched" };
  }

  @Get("street-view")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async streetView(
    @Query("lat") lat: string,
    @Query("lng") lng: string,
    @Query("heading") heading: string | undefined,
    @Query("pitch") pitch: string | undefined,
    @Query("fov") fov: string | undefined,
    @Query("size") size: string | undefined,
    @Res() res: Response
  ) {
    const image = await this.fleetService.getStreetViewPreview({
      lat,
      lng,
      heading,
      pitch,
      fov,
      size
    });

    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", image.cacheControl);
    res.send(image.buffer);
  }
}
