import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccidentEvidenceType, AccidentSeverity, AccidentStatus } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { AccidentsService } from "./accidents.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Accidents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("accidents")
export class AccidentsController {
  constructor(private readonly service: AccidentsService) {}

  @Get()
  @Permissions("accidents.view")
  async list(@Req() req: AuthedRequest, @Query("vehicleId") vehicleId?: string, @Query("status") status?: AccidentStatus) {
    const data = await this.service.list(req.user, { vehicleId, status });
    return { data, message: "Accidents fetched" };
  }

  @Post()
  @Permissions("accidents.report")
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      vehicleId: string;
      driverId?: string;
      occurredAt: string;
      location: string;
      description: string;
      severity?: AccidentSeverity;
      thirdPartyInvolved?: boolean;
      thirdPartyDetails?: string;
      policeReportNo?: string;
      estimatedDamageCost?: number;
      notes?: string;
    }
  ) {
    const data = await this.service.create(body, req.user);
    return { data, message: "Accident reported" };
  }

  @Get(":id")
  @Permissions("accidents.view")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.findOne(id, req.user);
    return { data, message: "Accident fetched" };
  }

  @Patch(":id")
  @Permissions("accidents.manage")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body()
    body: Partial<{
      severity: AccidentSeverity;
      status: AccidentStatus;
      thirdPartyDetails: string;
      policeReportNo: string;
      estimatedDamageCost: number;
      actualDamageCost: number;
      notes: string;
    }>
  ) {
    const data = await this.service.update(id, body, req.user);
    return { data, message: "Accident updated" };
  }

  @Post(":id/evidence")
  @Permissions("accidents.report")
  async addEvidence(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { evidenceType: AccidentEvidenceType; fileUrl: string; description?: string }
  ) {
    const data = await this.service.addEvidence(id, body, req.user);
    return { data, message: "Evidence added" };
  }

  @Post(":id/work-order")
  @Permissions("accidents.manage")
  async linkWorkOrder(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { technicianId?: string; estimatedCost?: number; priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" }
  ) {
    const data = await this.service.linkWorkOrder(id, body, req.user);
    return { data, message: "Work order linked to accident" };
  }
}
