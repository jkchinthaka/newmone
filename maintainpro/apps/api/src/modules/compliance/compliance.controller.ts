import { Controller, Get, Param, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ComplianceService } from "./compliance.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get("summary")
  @Permissions("compliance.view")
  async summary(@Req() req: AuthedRequest) {
    const data = await this.compliance.fleetSummary(req.user);
    return { data, message: "Fleet compliance summary" };
  }

  @Get("expiring-documents")
  @Permissions("compliance.view")
  async expiring(@Req() req: AuthedRequest, @Query("days") days?: string) {
    const within = Math.max(1, Math.min(365, Number(days) || 30));
    const data = await this.compliance.listExpiringDocuments(req.user, within);
    return { data, message: "Expiring documents" };
  }

  @Get("vehicles/:vehicleId")
  @Permissions("compliance.view")
  async vehicleCompliance(@Param("vehicleId") vehicleId: string) {
    const data = await this.compliance.getVehicleCompliance(vehicleId);
    return { data, message: "Vehicle compliance" };
  }
}
