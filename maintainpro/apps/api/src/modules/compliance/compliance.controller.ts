import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ComplianceService } from "./compliance.service";
import { CreateStatutoryCertificateDto, RenewStatutoryCertificateDto } from "./dto/statutory.dto";
import { StatutoryService } from "./statutory.service";
import type { StatutoryState } from "./statutory-catalog";

type AuthedRequest = { user: JwtPayload };

const CERTIFICATE_WRITE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR"];

@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService, private readonly statutory: StatutoryService) {}

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
  async vehicleCompliance(@Req() req: AuthedRequest, @Param("vehicleId") vehicleId: string) {
    const data = await this.compliance.getVehicleCompliance(vehicleId, req.user);
    return { data, message: "Vehicle compliance" };
  }

  @Get("certificates/types")
  @Permissions("compliance.view")
  certificateTypes() {
    return { data: this.statutory.catalog(), message: "Certificate types" };
  }

  @Get("certificates/summary")
  @Permissions("compliance.view")
  async certificateSummary(@Req() req: AuthedRequest) {
    return { data: await this.statutory.summary(req.user), message: "Certificate summary" };
  }

  @Get("certificates")
  @Permissions("compliance.view")
  async certificates(
    @Req() req: AuthedRequest,
    @Query("state") state?: string,
    @Query("assetId") assetId?: string,
    @Query("typeKey") typeKey?: string
  ) {
    const wanted = state === "VALID" || state === "DUE_SOON" || state === "EXPIRED" ? (state as StatutoryState) : undefined;
    return { data: await this.statutory.list(req.user, { state: wanted, assetId, typeKey }), message: "Certificates" };
  }

  @Post("certificates")
  @Roles(...CERTIFICATE_WRITE_ROLES)
  async createCertificate(@Req() req: AuthedRequest, @Body() dto: CreateStatutoryCertificateDto) {
    return { data: await this.statutory.create(req.user, dto), message: "Certificate saved" };
  }

  @Patch("certificates/:id/renew")
  @Roles(...CERTIFICATE_WRITE_ROLES)
  async renewCertificate(@Req() req: AuthedRequest, @Param("id") id: string, @Body() dto: RenewStatutoryCertificateDto) {
    return { data: await this.statutory.renew(req.user, id, dto), message: "Certificate renewed" };
  }

  @Delete("certificates/:id")
  @Roles(...CERTIFICATE_WRITE_ROLES)
  async removeCertificate(@Req() req: AuthedRequest, @Param("id") id: string) {
    return { data: await this.statutory.remove(req.user, id), message: "Certificate removed" };
  }
}
