import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ReliabilityService } from "./reliability.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Reliability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ReliabilityController {
  constructor(private readonly reliability: ReliabilityService) {}

  @Get("reliability/policy")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR")
  @Permissions("reliability.view")
  async getPolicy(@Req() req: AuthedRequest) {
    const data = await this.reliability.getPolicy(req.user);
    return { data, message: "Reliability policy" };
  }

  @Patch("reliability/policy")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("reliability.manage")
  async updatePolicy(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    const data = await this.reliability.updatePolicy(req.user, {
      repeatWindowDays: body.repeatWindowDays != null ? Number(body.repeatWindowDays) : undefined,
      matchSameFaultCode: body.matchSameFaultCode != null ? Boolean(body.matchSameFaultCode) : undefined,
      matchSameAsset: body.matchSameAsset != null ? Boolean(body.matchSameAsset) : undefined,
      requireRcaOnRepeat: body.requireRcaOnRepeat != null ? Boolean(body.requireRcaOnRepeat) : undefined,
      requirePermitForCriticalAssets:
        body.requirePermitForCriticalAssets != null
          ? Boolean(body.requirePermitForCriticalAssets)
          : undefined,
      permitRequiredCriticalities: Array.isArray(body.permitRequiredCriticalities)
        ? body.permitRequiredCriticalities.map(String)
        : typeof body.permitRequiredCriticalities === "string"
          ? String(body.permitRequiredCriticalities)
              .split(",")
              .map((s) => s.trim())
          : undefined,
      reason: body.reason ? String(body.reason) : undefined
    });
    return { data, message: "Reliability policy updated" };
  }

  @Get("work-orders/:id/downtime")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "AUDITOR")
  @Permissions("reliability.view")
  async listDowntime(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.reliability.summarizeDowntime(req.user, id);
    return { data, message: "Downtime segments" };
  }

  @Post("work-orders/:id/downtime")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  @Permissions("reliability.manage")
  async openDowntime(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.category) throw new BadRequestException("category is required");
    const data = await this.reliability.openDowntime(req.user, id, {
      category: String(body.category),
      planned: body.planned != null ? Boolean(body.planned) : undefined,
      reasonCode: body.reasonCode ? String(body.reasonCode) : undefined,
      reasonNotes: body.reasonNotes ? String(body.reasonNotes) : undefined,
      startedAt: body.startedAt ? String(body.startedAt) : undefined,
      productionAffected: body.productionAffected != null ? Boolean(body.productionAffected) : undefined,
      estimatedLostHours: body.estimatedLostHours != null ? Number(body.estimatedLostHours) : undefined,
      estimatedLostUnits: body.estimatedLostUnits != null ? Number(body.estimatedLostUnits) : undefined
    });
    return { data, message: "Downtime segment opened" };
  }

  @Post("downtime/:segmentId/close")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC")
  @Permissions("reliability.manage")
  async closeDowntime(
    @Req() req: AuthedRequest,
    @Param("segmentId") segmentId: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.reliability.closeDowntime(req.user, segmentId, {
      endedAt: body.endedAt ? String(body.endedAt) : undefined,
      reasonNotes: body.reasonNotes ? String(body.reasonNotes) : undefined
    });
    return { data, message: "Downtime segment closed" };
  }

  @Get("reliability/rca")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "AUDITOR")
  @Permissions("reliability.view")
  async listRca(
    @Req() req: AuthedRequest,
    @Query("workOrderId") workOrderId?: string,
    @Query("assetId") assetId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.reliability.listRca(req.user, { workOrderId, assetId, status });
    return { data, message: "RCA cases" };
  }

  @Post("reliability/rca")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN")
  @Permissions("reliability.manage")
  async createRca(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    if (!body.problemStatement) throw new BadRequestException("problemStatement is required");
    const data = await this.reliability.createRca(req.user, {
      workOrderId: body.workOrderId ? String(body.workOrderId) : undefined,
      assetId: body.assetId ? String(body.assetId) : undefined,
      vehicleId: body.vehicleId ? String(body.vehicleId) : undefined,
      problemStatement: String(body.problemStatement),
      failureCode: body.failureCode ? String(body.failureCode) : undefined,
      causeCode: body.causeCode ? String(body.causeCode) : undefined,
      evidence: Array.isArray(body.evidence) ? body.evidence.map(String) : undefined,
      fiveWhy: Array.isArray(body.fiveWhy) ? body.fiveWhy.map(String) : undefined,
      ownerId: body.ownerId ? String(body.ownerId) : undefined
    });
    return { data, message: "RCA case created" };
  }

  @Patch("reliability/rca/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("reliability.manage")
  async updateRca(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.reliability.updateRca(req.user, id, {
      status: body.status ? String(body.status) : undefined,
      rootCause: body.rootCause != null ? String(body.rootCause) : undefined,
      failureCode: body.failureCode != null ? String(body.failureCode) : undefined,
      causeCode: body.causeCode != null ? String(body.causeCode) : undefined,
      fiveWhy: Array.isArray(body.fiveWhy) ? body.fiveWhy.map(String) : undefined,
      evidence: Array.isArray(body.evidence) ? body.evidence.map(String) : undefined,
      ownerId: body.ownerId ? String(body.ownerId) : undefined
    });
    return { data, message: "RCA case updated" };
  }

  @Post("reliability/rca/:id/capa")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("reliability.manage")
  async addCapa(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.kind || !body.description) {
      throw new BadRequestException("kind and description are required");
    }
    const data = await this.reliability.addCapa(req.user, id, {
      kind: String(body.kind),
      description: String(body.description),
      ownerId: body.ownerId ? String(body.ownerId) : undefined,
      dueDate: body.dueDate ? String(body.dueDate) : undefined
    });
    return { data, message: "CAPA action added" };
  }

  @Patch("reliability/capa/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("reliability.manage")
  async updateCapa(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    const data = await this.reliability.updateCapa(req.user, id, {
      status: body.status ? String(body.status) : undefined,
      verificationNote: body.verificationNote != null ? String(body.verificationNote) : undefined,
      dueDate: body.dueDate ? String(body.dueDate) : undefined
    });
    return { data, message: "CAPA action updated" };
  }

  @Get("work-permits")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC", "AUDITOR")
  @Permissions("safety.permit.view")
  async listPermits(
    @Req() req: AuthedRequest,
    @Query("workOrderId") workOrderId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.reliability.listPermits(req.user, { workOrderId, status });
    return { data, message: "Work permits" };
  }

  @Post("work-permits")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("safety.permit.manage")
  async createPermit(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    if (!body.workOrderId || !body.permitType) {
      throw new BadRequestException("workOrderId and permitType are required");
    }
    const data = await this.reliability.createPermit(req.user, {
      workOrderId: String(body.workOrderId),
      permitType: String(body.permitType),
      hazards: Array.isArray(body.hazards) ? body.hazards.map(String) : undefined,
      ppe: Array.isArray(body.ppe) ? body.ppe.map(String) : undefined,
      validFrom: body.validFrom ? String(body.validFrom) : undefined,
      validTo: body.validTo ? String(body.validTo) : undefined,
      notes: body.notes ? String(body.notes) : undefined
    });
    return { data, message: "Work permit created" };
  }

  @Patch("work-permits/:id/status")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("safety.permit.manage")
  async transitionPermit(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.status) throw new BadRequestException("status is required");
    const data = await this.reliability.transitionPermit(req.user, id, {
      status: String(body.status),
      notes: body.notes != null ? String(body.notes) : undefined
    });
    return { data, message: "Work permit status updated" };
  }

  @Get("reliability/asset-criticality")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "AUDITOR")
  @Permissions("reliability.view")
  async listCriticality(
    @Req() req: AuthedRequest,
    @Query("criticalityLevel") criticalityLevel?: string
  ) {
    const data = await this.reliability.listAssetCriticality(req.user, { criticalityLevel });
    return { data, message: "Asset criticality" };
  }

  @Patch("assets/:id/criticality")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER")
  @Permissions("reliability.manage")
  async setCriticality(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.criticalityLevel) throw new BadRequestException("criticalityLevel is required");
    const data = await this.reliability.setAssetCriticality(req.user, id, {
      criticalityLevel: String(body.criticalityLevel),
      reason: body.reason ? String(body.reason) : undefined
    });
    return { data, message: "Asset criticality updated" };
  }
}
