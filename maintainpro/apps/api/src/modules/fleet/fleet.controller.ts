import { Body, Controller, Delete, Get, Inject, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
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

  @Get("alerts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER")
  async alerts(@Query("limit") limitRaw?: string) {
    const limit = this.toPositiveInt(limitRaw, 50);
    const data = this.fleetService.listAlerts(limit);
    return { data, message: "Fleet alerts fetched" };
  }

  @Get("geofences")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER")
  async geofences() {
    const data = this.fleetService.listGeofences();
    return { data, message: "Fleet geofences fetched" };
  }

  @Post("geofences")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER")
  async createGeofence(
    @Body()
    body: {
      name: string;
      type: "DEPOT" | "RESTRICTED" | "CUSTOMER";
      shape: "CIRCLE" | "POLYGON";
      center?: {
        lat: number;
        lng: number;
      };
      radiusMeters?: number;
      points?: Array<{
        lat: number;
        lng: number;
      }>;
    }
  ) {
    const data = this.fleetService.createGeofence(body);
    return { data, message: "Geofence created" };
  }

  @Delete("geofences/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR", "MANAGER")
  async removeGeofence(@Param("id") id: string) {
    const data = this.fleetService.removeGeofence(id);
    return { data, message: "Geofence removed" };
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

  private toPositiveInt(value: string | undefined, fallback: number) {
    if (!value) {
      return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }
}
