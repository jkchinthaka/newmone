import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { TyreCondition } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
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

  // ── Overview ──────────────────────────────────────────────────────────────

  @Get("overview")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER", "VIEWER")
  @Permissions("fleet.view")
  async overview(@Req() req: AuthedRequest) {
    const data = await this.fleet.fleetHomeSummary(req.user);
    return { data, message: "Fleet overview" };
  }

  // ── Vehicle / Asset backfill ──────────────────────────────────────────────

  @Post("vehicles/backfill-assets")
  @Roles("SUPER_ADMIN", "ADMIN")
  @Permissions("fleet.vehicle.manage")
  async backfillAssets(
    @Req() req: AuthedRequest,
    @Query("dryRun") dryRun?: string
  ) {
    const data = await this.fleet.previewVehicleAssetBackfill(req.user, {
      dryRun: dryRun !== "false"
    });
    return { data, message: `Vehicle-asset backfill (${data.mode})` };
  }

  @Post("vehicles/:id/ensure-mileage-meter")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER")
  @Permissions("fleet.vehicle.manage")
  async ensureMileageMeter(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.fleet.ensureMileageMeter(req.user, id);
    return { data, message: "Mileage meter ensured" };
  }

  // ── Gate eligibility (read-only) ─────────────────────────────────────────

  @Get("vehicles/:id/gate-eligibility")
  @Roles(
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "FLEET_MANAGER",
    "SECURITY_OFFICER",
    "DRIVER",
    "VIEWER"
  )
  @Permissions("gate.check")
  async gateEligibility(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query("driverId") driverId?: string
  ) {
    const data = await this.fleet.evaluateGateEligibility(req.user, id, driverId);
    return { data, message: data.allowed ? "Vehicle eligible for gate-out" : "Vehicle blocked" };
  }

  // ── Tyre management ───────────────────────────────────────────────────────

  @Post("tyres/install")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("fleet.tyre.manage")
  async installTyre(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.installTyre(req.user, {
      ...body,
      installedAt: body.installedAt ? new Date(body.installedAt) : undefined,
      warrantyExpiresAt: body.warrantyExpiresAt
        ? new Date(body.warrantyExpiresAt)
        : undefined,
      condition: body.condition as TyreCondition | undefined
    });
    return { data, message: "Tyre installed" };
  }

  @Post("tyres/:id/move")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("fleet.tyre.manage")
  async moveTyre(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.fleet.moveTyre(req.user, id, body);
    return { data, message: "Tyre moved" };
  }

  @Post("tyres/:id/remove")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("fleet.tyre.manage")
  async removeTyre(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.fleet.removeTyre(req.user, id, body);
    return { data, message: "Tyre removed" };
  }

  // ── Battery management ────────────────────────────────────────────────────

  @Post("batteries/install")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("fleet.battery.manage")
  async installBattery(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.fleet.installBattery(req.user, {
      ...body,
      installedAt: body.installedAt ? new Date(body.installedAt) : undefined,
      warrantyExpiresAt: body.warrantyExpiresAt
        ? new Date(body.warrantyExpiresAt)
        : undefined
    });
    return { data, message: "Battery installed" };
  }

  @Post("batteries/:id/replace")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "TECHNICIAN", "MECHANIC")
  @Permissions("fleet.battery.manage")
  async replaceBattery(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.fleet.replaceBattery(req.user, id, {
      ...body,
      warrantyExpiresAt: body.warrantyExpiresAt
        ? new Date(body.warrantyExpiresAt)
        : undefined
    });
    return { data, message: "Battery replaced" };
  }

  // ── Driver assignment ─────────────────────────────────────────────────────

  @Post("vehicles/:id/assign-driver")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER")
  @Permissions("fleet.assignment.manage")
  async assignDriver(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: any
  ) {
    const data = await this.fleet.assignDriver(req.user, id, body.driverId, {
      openingMileage: body.openingMileage,
      notes: body.notes
    });
    return { data, message: "Driver assigned" };
  }

  @Post("assignments/:id/return")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "OPERATIONS_MANAGER")
  @Permissions("fleet.assignment.manage")
  async returnAssignment(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: any
  ) {
    const data = await this.fleet.returnAssignment(req.user, id, {
      closingMileage: body.closingMileage,
      notes: body.notes
    });
    return { data, message: "Assignment returned" };
  }

  // ── Fuel efficiency & cost ────────────────────────────────────────────────

  @Get("fuel-efficiency")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "VIEWER")
  @Permissions("fleet.view")
  fuelEfficiency(@Query() query: any) {
    const data = this.fleet.computeFuelReport({
      litres: Number(query.litres),
      distanceKm: Number(query.distanceKm),
      amount: Number(query.amount)
    });
    return { data, message: "Fuel efficiency computed" };
  }

  @Get("cost-per-km")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER", "VIEWER")
  @Permissions("fleet.view")
  costPerKm(@Query() query: any) {
    const data = this.fleet.computeCostPerKm({
      maintenanceCost: Number(query.maintenanceCost),
      distanceKm: Number(query.distanceKm)
    });
    return { data: { costPerKm: data }, message: "Cost per km computed" };
  }

  // ── Accident → WO → Claim chain ───────────────────────────────────────────

  @Post("accidents/:id/link-repair")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "FLEET_MANAGER")
  @Permissions("fleet.accident.manage")
  async linkRepair(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.fleet.linkAccidentRepairClaim(req.user, {
      accidentId: id,
      repairWorkOrderId: body.repairWorkOrderId,
      insuranceClaimId: body.insuranceClaimId
    });
    return { data, message: "Accident repair chain linked" };
  }
}
