import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InsuranceClaimStatus } from "@prisma/client";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { InsuranceClaimsService } from "./insurance-claims.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Insurance Claims")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("insurance-claims")
export class InsuranceClaimsController {
  constructor(private readonly service: InsuranceClaimsService) {}

  @Get()
  @Permissions("insurance_claims.view")
  async list(@Req() req: AuthedRequest, @Query("vehicleId") vehicleId?: string, @Query("status") status?: InsuranceClaimStatus) {
    const data = await this.service.list(req.user, { vehicleId, status });
    return { data, message: "Insurance claims fetched" };
  }

  @Post()
  @Permissions("insurance_claims.manage")
  async create(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      vehicleId: string;
      accidentId?: string;
      policyNumber: string;
      insurerName: string;
      claimAmount: number;
      documents?: string[];
      notes?: string;
    }
  ) {
    const data = await this.service.create(body, req.user);
    return { data, message: "Insurance claim created" };
  }

  @Get(":id")
  @Permissions("insurance_claims.view")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.findOne(id, req.user);
    return { data, message: "Insurance claim fetched" };
  }

  @Patch(":id")
  @Permissions("insurance_claims.manage")
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { policyNumber?: string; insurerName?: string; documents?: string[]; notes?: string }
  ) {
    const data = await this.service.update(id, body, req.user);
    return { data, message: "Insurance claim updated" };
  }

  @Post(":id/status")
  @Permissions("insurance_claims.approve")
  async updateStatus(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { status: InsuranceClaimStatus; approvedAmount?: number; notes?: string }
  ) {
    const data = await this.service.updateStatus(id, body, req.user);
    return { data, message: "Insurance claim status updated" };
  }
}
