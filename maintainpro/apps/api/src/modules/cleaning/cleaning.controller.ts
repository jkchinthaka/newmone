import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CleaningVisitStatus, FacilityIssueStatus } from "@prisma/client";
import type { Request } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

import { CleaningService } from "./cleaning.service";
import {
  CreateCleaningLocationDto,
  UpdateCleaningLocationDto
} from "./dto/cleaning-location.dto";
import {
  SignOffVisitDto,
  StartCleaningVisitDto,
  SubmitCleaningVisitDto
} from "./dto/cleaning-visit.dto";
import {
  CreateFacilityIssueDto,
  UpdateFacilityIssueDto
} from "./dto/facility-issue.dto";

interface AuthedRequest extends Request {
  user?: { sub: string; role: string; tenantId?: string | null };
}

@ApiTags("Cleaning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("cleaning")
export class CleaningController {
  constructor(@Inject(CleaningService) private readonly cleaning: CleaningService) {}

  // ---------- Locations ----------

  @Get("locations")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER", "ASSET_MANAGER")
  async listLocations(@Req() req: AuthedRequest) {
    const data = await this.cleaning.listLocations(req.user?.tenantId ?? null);
    return { data, message: "Cleaning locations fetched" };
  }

  @Post("locations")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR")
  async createLocation(@Req() req: AuthedRequest, @Body() dto: CreateCleaningLocationDto) {
    const data = await this.cleaning.createLocation(req.user?.tenantId ?? null, dto);
    return { data, message: "Cleaning location created" };
  }

  @Get("locations/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER")
  async getLocation(@Param("id") id: string) {
    const data = await this.cleaning.getLocation(id);
    return { data, message: "Cleaning location fetched" };
  }

  @Patch("locations/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR")
  async updateLocation(@Param("id") id: string, @Body() dto: UpdateCleaningLocationDto) {
    const data = await this.cleaning.updateLocation(id, dto);
    return { data, message: "Cleaning location updated" };
  }

  @Delete("locations/:id")
  @Roles("SUPER_ADMIN", "ADMIN")
  async deleteLocation(@Param("id") id: string) {
    const data = await this.cleaning.removeLocation(id);
    return { data, message: "Cleaning location deactivated" };
  }

  // ---------- Visits ----------

  @Post("visits/scan")
  @Roles("CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN")
  async scan(@Req() req: AuthedRequest, @Body() dto: StartCleaningVisitDto) {
    const cleanerId = req.user!.sub;
    const data = await this.cleaning.startVisit(cleanerId, req.user?.tenantId ?? null, dto);
    return { data, message: "Cleaning visit started" };
  }

  @Post("visits/:id/submit")
  @Roles("CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN")
  async submitVisit(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: SubmitCleaningVisitDto
  ) {
    const data = await this.cleaning.submitVisit(id, req.user!.sub, dto);
    return { data, message: "Cleaning visit submitted" };
  }

  @Post("visits/:id/sign-off")
  @Roles("SUPERVISOR", "ADMIN", "SUPER_ADMIN")
  async signOff(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: SignOffVisitDto
  ) {
    const data = await this.cleaning.signOffVisit(id, req.user!.sub, dto);
    return {
      data,
      message: dto.approve ? "Visit approved" : "Visit rejected"
    };
  }

  @Get("visits")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER")
  async listVisits(
    @Req() req: AuthedRequest,
    @Query("status") status?: CleaningVisitStatus,
    @Query("locationId") locationId?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const role = req.user?.role;
    const cleanerId = role === "CLEANER" ? req.user!.sub : undefined;
    const data = await this.cleaning.listVisits({
      tenantId: req.user?.tenantId ?? null,
      cleanerId,
      locationId,
      status,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined
    });
    return { data, message: "Cleaning visits fetched" };
  }

  @Get("visits/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER")
  async getVisit(@Param("id") id: string) {
    const data = await this.cleaning.getVisit(id);
    return { data, message: "Cleaning visit fetched" };
  }

  // ---------- Issues ----------

  @Post("issues")
  @Roles("CLEANER", "SUPERVISOR", "ADMIN", "SUPER_ADMIN", "ASSET_MANAGER")
  async createIssue(@Req() req: AuthedRequest, @Body() dto: CreateFacilityIssueDto) {
    const data = await this.cleaning.createIssue(
      req.user!.sub,
      req.user?.tenantId ?? null,
      dto
    );
    return { data, message: "Issue reported" };
  }

  @Get("issues")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR", "CLEANER", "ASSET_MANAGER")
  async listIssues(@Req() req: AuthedRequest, @Query("status") status?: FacilityIssueStatus) {
    const data = await this.cleaning.listIssues(req.user?.tenantId ?? null, status);
    return { data, message: "Issues fetched" };
  }

  @Patch("issues/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR")
  async updateIssue(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFacilityIssueDto
  ) {
    const data = await this.cleaning.updateIssue(id, req.user!.sub, dto);
    return { data, message: "Issue updated" };
  }

  // ---------- Dashboard ----------

  @Get("dashboard")
  @Roles("SUPER_ADMIN", "ADMIN", "SUPERVISOR")
  async dashboard(@Req() req: AuthedRequest, @Query("days") days?: string) {
    const data = await this.cleaning.dashboard(
      req.user?.tenantId ?? null,
      days ? Number(days) : 30
    );
    return { data, message: "Cleaning dashboard fetched" };
  }
}
