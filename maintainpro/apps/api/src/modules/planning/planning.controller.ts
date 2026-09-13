import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CalibrationResult, InspectionResult, PmTriggerCombineMode } from "@prisma/client";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { PlanningService } from "./planning.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Planning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("planning")
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Post("pm-plans")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async createPmPlan(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.planning.createPmPlan(req.user, {
      ...body,
      combineMode: body.combineMode as PmTriggerCombineMode | undefined,
      effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined
    });
    return { data, message: "PM plan created" };
  }

  @Put("pm-plans/:id/revise")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async revisePmPlan(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.planning.revisePmPlan(
      req.user,
      id,
      body.patch ?? body,
      body.changeReason
    );
    return { data, message: "PM plan revised" };
  }

  @Get("pm-plans/:id/revisions")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN", "VIEWER")
  async revisionHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.planning.listRevisionHistory(req.user, id);
    return { data, message: "PM revision history" };
  }

  @Post("pm-plans/:id/auto-wo")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async autoWo(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.planning.autoCreateWorkOrderIfDue(req.user, id, {
      now: body?.now ? new Date(body.now) : undefined,
      currentMeterValue: body?.currentMeterValue,
      expiresAt: body?.expiresAt ? new Date(body.expiresAt) : undefined,
      conditionMet: body?.conditionMet,
      eventFired: body?.eventFired
    });
    return { data, message: data.reason };
  }

  @Post("meters/:id/readings")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async recordReading(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: any) {
    const data = await this.planning.recordMeterReading(req.user, id, {
      value: Number(body.value),
      source: body.source,
      deviceId: body.deviceId,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
      notes: body.notes
    });
    return { data, message: "Meter reading recorded" };
  }

  @Post("inspections")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async completeInspection(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.planning.completeInspection(req.user, {
      ...body,
      result: body.result as InspectionResult
    });
    return { data, message: "Inspection recorded" };
  }

  @Post("calibrations")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN")
  async recordCalibration(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.planning.recordCalibration(req.user, {
      ...body,
      result: body.result as CalibrationResult,
      lastCalibratedAt: body.lastCalibratedAt ? new Date(body.lastCalibratedAt) : undefined,
      nextDueAt: body.nextDueAt ? new Date(body.nextDueAt) : undefined
    });
    return { data, message: "Calibration recorded" };
  }

  @Post("compliance")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  async upsertCompliance(@Req() req: AuthedRequest, @Body() body: any) {
    const data = await this.planning.upsertComplianceRequirement(req.user, {
      ...body,
      issuedAt: body.issuedAt ? new Date(body.issuedAt) : undefined,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined
    });
    return { data, message: "Compliance requirement saved" };
  }
}
