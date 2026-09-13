import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { FleetLifecycleService } from "./fleet-lifecycle.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Fleet Lifecycle")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("fleet-lifecycle")
export class FleetLifecycleController {
  constructor(private readonly fleet: FleetLifecycleService) {}

  @Post("vehicles/:id/link-asset")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async linkAsset(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.fleet.linkVehicleToAsset(req.user, id, body.assetId);
    return { data, message: "Vehicle linked to asset" };
  }

  @Post("tyres")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC")
  async tyre(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.upsertTyre(req.user, {
      ...body,
      installedAt: body.installedAt ? new Date(body.installedAt) : undefined
    });
    return { data, message: "Tyre saved" };
  }

  @Post("batteries")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC")
  async battery(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.upsertBattery(req.user, {
      ...body,
      installedAt: body.installedAt ? new Date(body.installedAt) : undefined,
      warrantyExpiresAt: body.warrantyExpiresAt ? new Date(body.warrantyExpiresAt) : undefined
    });
    return { data, message: "Battery saved" };
  }

  @Post("gate-out")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SECURITY_OFFICER", "ASSET_MANAGER")
  async gateOut(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.evaluateAndRecordGateOut(req.user, body);
    return { data, message: data.status };
  }

  @Post("fuel-efficiency")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER", "ASSET_MANAGER")
  fuelReport(@Body() body: any) {
    const data = this.fleet.computeFuelReport({
      litres: Number(body.litres),
      distanceKm: Number(body.distanceKm),
      amount: Number(body.amount)
    });
    return { data, message: "Fuel efficiency" };
  }

  @Post("accident-chain")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async accidentChain(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.linkAccidentRepairClaim(req.user, body);
    return { data, message: "Accident repair/claim linkage" };
  }
}
