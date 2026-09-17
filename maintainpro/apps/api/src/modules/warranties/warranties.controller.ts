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
import { WarrantiesService } from "./warranties.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Warranties")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("warranties")
export class WarrantiesController {
  constructor(private readonly warranties: WarrantiesService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR", "MECHANIC", "VIEWER", "AUDITOR")
  @Permissions("warranty.view")
  async list(
    @Req() req: AuthedRequest,
    @Query("subjectType") subjectType?: string,
    @Query("subjectId") subjectId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.warranties.list(req.user, { subjectType, subjectId, status });
    return { data, message: "Warranties" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("warranty.manage")
  async create(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    if (!body.subjectType || !body.subjectId || !body.provider || !body.startDate || !body.endDate) {
      throw new BadRequestException("subjectType, subjectId, provider, startDate, endDate are required");
    }
    const data = await this.warranties.create(req.user, {
      subjectType: String(body.subjectType),
      subjectId: String(body.subjectId),
      provider: String(body.provider),
      reference: body.reference ? String(body.reference) : undefined,
      coverageType: body.coverageType ? String(body.coverageType) : undefined,
      coverageNotes: body.coverageNotes ? String(body.coverageNotes) : undefined,
      startDate: String(body.startDate),
      endDate: String(body.endDate),
      mileageLimit: body.mileageLimit != null ? Number(body.mileageLimit) : undefined,
      hourLimit: body.hourLimit != null ? Number(body.hourLimit) : undefined,
      documentUrls: Array.isArray(body.documentUrls) ? body.documentUrls.map(String) : undefined,
      policyAction: body.policyAction ? String(body.policyAction) : undefined,
      reason: body.reason ? String(body.reason) : undefined
    });
    return { data, message: "Warranty created" };
  }

  @Get("claims")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR", "AUDITOR", "FINANCE")
  @Permissions("warranty.view")
  async listClaims(
    @Req() req: AuthedRequest,
    @Query("warrantyId") warrantyId?: string,
    @Query("workOrderId") workOrderId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.warranties.listClaims(req.user, { warrantyId, workOrderId, status });
    return { data, message: "Warranty claims" };
  }

  @Post("claims")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "SUPERVISOR")
  @Permissions("warranty.manage")
  async createClaim(@Req() req: AuthedRequest, @Body() body: Record<string, unknown>) {
    if (!body.warrantyId) throw new BadRequestException("warrantyId is required");
    const data = await this.warranties.createClaim(req.user, {
      warrantyId: String(body.warrantyId),
      workOrderId: body.workOrderId ? String(body.workOrderId) : undefined,
      claimAmount: body.claimAmount != null ? Number(body.claimAmount) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      documentUrls: Array.isArray(body.documentUrls) ? body.documentUrls.map(String) : undefined,
      reason: body.reason ? String(body.reason) : undefined
    });
    return { data, message: "Warranty claim created" };
  }

  @Patch("claims/:id/status")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  @Permissions("warranty.manage")
  async transition(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    if (!body.status) throw new BadRequestException("status is required");
    const data = await this.warranties.transitionClaim(req.user, id, {
      status: String(body.status),
      approvedAmount: body.approvedAmount != null ? Number(body.approvedAmount) : undefined,
      recoveredAmount: body.recoveredAmount != null ? Number(body.recoveredAmount) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      reason: body.reason ? String(body.reason) : undefined
    });
    return { data, message: "Warranty claim updated" };
  }
}
