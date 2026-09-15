import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  AssetMeterType,
  CalibrationResult,
  InspectionResult,
  PmPlanStatus,
  PmTriggerCombineMode,
  Priority,
  WorkOrderType
} from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { PlanningService } from "./planning.service";

type AuthedRequest = { user: JwtPayload };

const MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "FACILITY_MANAGER"] as const;
const READ_ROLES = [
  ...MANAGE_ROLES,
  "MECHANIC",
  "TECHNICIAN",
  "VIEWER",
  "SUPERVISOR",
  "OPERATIONS_MANAGER"
] as const;
const FIELD_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"] as const;

@ApiTags("Planning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("planning")
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}

  @Get("pm-plans")
  @Roles(...READ_ROLES)
  @Permissions("planning.view")
  async listPmPlans(
    @Req() req: AuthedRequest,
    @Query("status") status?: PmPlanStatus,
    @Query("siteId") siteId?: string,
    @Query("assetId") assetId?: string,
    @Query("vehicleId") vehicleId?: string
  ) {
    const data = await this.planning.listPmPlans(req.user, {
      status,
      siteId,
      assetId,
      vehicleId
    });
    return { data, message: "PM plans" };
  }

  @Post("pm-plans")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async createPmPlan(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.createPmPlan(req.user, {
      ...(body as object),
      combineMode: body.combineMode as PmTriggerCombineMode | undefined,
      priority: body.priority as Priority | undefined,
      workType: body.workType as WorkOrderType | undefined,
      effectiveFrom: body.effectiveFrom ? new Date(String(body.effectiveFrom)) : undefined
    } as Parameters<PlanningService["createPmPlan"]>[1]);
    return { data, message: "PM plan created" };
  }

  @Put("pm-plans/:id/revise")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async revisePmPlan(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { patch?: Record<string, unknown>; changeReason?: string } & Record<string, unknown>
  ) {
    const data = await this.planning.revisePmPlan(
      req.user,
      id,
      (body.patch ?? body) as Record<string, unknown>,
      body.changeReason
    );
    return { data, message: "PM plan revised" };
  }

  @Get("pm-plans/:id/revisions")
  @Roles(...READ_ROLES)
  @Permissions("planning.view")
  async revisionHistory(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.planning.listRevisionHistory(req.user, id);
    return { data, message: "PM revision history" };
  }

  @Post("pm-plans/:id/auto-wo")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async autoWo(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.planning.autoCreateWorkOrderIfDue(req.user, id, {
      now: body?.now ? new Date(String(body.now)) : undefined,
      currentMeterValue:
        body?.currentMeterValue != null ? Number(body.currentMeterValue) : undefined,
      expiresAt: body?.expiresAt ? new Date(String(body.expiresAt)) : undefined,
      conditionMet: body?.conditionMet as boolean | undefined,
      eventFired: body?.eventFired as boolean | undefined
    });
    return { data, message: data.reason };
  }

  @Get("due-work")
  @Roles(...READ_ROLES)
  @Permissions("planning.view")
  async dueWork(@Req() req: AuthedRequest, @Query("now") now?: string) {
    const data = await this.planning.listDueWork(req.user, {
      now: now ? new Date(now) : undefined
    });
    return { data, message: "Due PM work" };
  }

  @Post("meters")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async createMeter(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.createMeter(req.user, {
      assetId: body.assetId as string | undefined,
      vehicleId: body.vehicleId as string | undefined,
      meterType: body.meterType as AssetMeterType,
      name: String(body.name ?? ""),
      unit: String(body.unit ?? ""),
      currentValue: body.currentValue != null ? Number(body.currentValue) : undefined,
      staleAfterDays: body.staleAfterDays != null ? Number(body.staleAfterDays) : undefined,
      jumpWarningThreshold:
        body.jumpWarningThreshold != null ? Number(body.jumpWarningThreshold) : undefined
    });
    return { data, message: "Meter created" };
  }

  @Post("meters/:id/readings")
  @Roles(...FIELD_ROLES)
  @Permissions("planning.manage")
  async recordReading(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.planning.recordMeterReading(req.user, id, {
      value: Number(body.value),
      source: body.source as "USER" | "DEVICE" | "IMPORT" | "SYSTEM" | undefined,
      deviceId: body.deviceId as string | undefined,
      recordedAt: body.recordedAt ? new Date(String(body.recordedAt)) : undefined,
      notes: body.notes as string | undefined
    });
    return { data, message: "Meter reading recorded" };
  }

  @Post("checklist-templates")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async createChecklistTemplate(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.createChecklistTemplate(
      req.user,
      body as Parameters<PlanningService["createChecklistTemplate"]>[1]
    );
    return { data, message: "Checklist template created" };
  }

  @Post("inspections")
  @Roles(...FIELD_ROLES)
  @Permissions("planning.manage")
  async completeInspection(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.completeInspection(req.user, {
      ...(body as object),
      result: body.result as InspectionResult
    } as Parameters<PlanningService["completeInspection"]>[1]);
    return { data, message: "Inspection recorded" };
  }

  @Post("calibrations")
  @Roles(...FIELD_ROLES)
  @Permissions("planning.manage")
  async recordCalibration(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.recordCalibration(req.user, {
      ...(body as object),
      result: body.result as CalibrationResult,
      lastCalibratedAt: body.lastCalibratedAt
        ? new Date(String(body.lastCalibratedAt))
        : undefined,
      nextDueAt: body.nextDueAt ? new Date(String(body.nextDueAt)) : undefined
    } as Parameters<PlanningService["recordCalibration"]>[1]);
    return { data, message: "Calibration recorded" };
  }

  @Post("compliance")
  @Roles(...MANAGE_ROLES)
  @Permissions("planning.manage")
  async upsertCompliance(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.planning.upsertComplianceRequirement(req.user, {
      ...(body as object),
      issuedAt: body.issuedAt ? new Date(String(body.issuedAt)) : undefined,
      expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : undefined
    } as Parameters<PlanningService["upsertComplianceRequirement"]>[1]);
    return { data, message: "Compliance requirement saved" };
  }
}
