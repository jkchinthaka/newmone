import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import {
  BestDriversQueryDto,
  DriverIntelligenceListQueryDto,
  IntelligenceFiltersDto,
  UpdateDriverIntelligenceInputsDto
} from "./dto/driver-intelligence.dto";
import { DriverIntelligenceService } from "./driver-intelligence.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Driver Intelligence")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("driver-intelligence")
export class DriverIntelligenceController {
  constructor(private readonly service: DriverIntelligenceService) {}

  @Get("dashboard")
  @Permissions("dashboard_analytics.view")
  async dashboard(@Req() req: AuthedRequest, @Query() query: IntelligenceFiltersDto): Promise<{ data: unknown; message: string }> {
    const data = await this.service.dashboard(req.user, query);
    return { data, message: "Driver intelligence dashboard fetched" };
  }

  @Get("drivers")
  @Permissions("driver_intelligence.view")
  async listDrivers(
    @Req() req: AuthedRequest,
    @Query() query: DriverIntelligenceListQueryDto
  ): Promise<{ data: unknown; message: string }> {
    const data = await this.service.listDrivers(req.user, query);
    return { data, message: "Driver intelligence list fetched" };
  }

  @Get("drivers/:id")
  @Permissions("driver_intelligence.view")
  async driverProfile(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query() query: IntelligenceFiltersDto
  ): Promise<{ data: unknown; message: string }> {
    const data = await this.service.driverProfile(req.user, id, query);
    return { data, message: "Driver intelligence profile fetched" };
  }

  @Get("drivers/:id/eligibility")
  @Permissions("driver_intelligence.view")
  async driverEligibility(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Query() query: IntelligenceFiltersDto
  ): Promise<{ data: unknown; message: string }> {
    const data = await this.service.driverEligibility(req.user, id, query);
    return { data, message: "Driver eligibility fetched" };
  }

  @Patch("drivers/:id/inputs")
  @Permissions("driver_intelligence.manage")
  async updateDriverInputs(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateDriverIntelligenceInputsDto
  ): Promise<{ data: unknown; message: string }> {
    const data = await this.service.updateDriverInputs(req.user, id, body);
    return { data, message: "Driver intelligence inputs updated" };
  }

  @Get("rankings/best-drivers")
  @Permissions("driver_intelligence.view")
  async bestDrivers(@Req() req: AuthedRequest, @Query() query: BestDriversQueryDto): Promise<{ data: unknown; message: string }> {
    const data = await this.service.bestDrivers(req.user, query);
    return { data, message: "Best driver ranking fetched" };
  }

  @Get("vehicles/:vehicleId/cost-summary")
  @Permissions("vehicle_cost_analytics.view")
  async vehicleCostSummary(
    @Req() req: AuthedRequest,
    @Param("vehicleId") vehicleId: string,
    @Query() query: IntelligenceFiltersDto
  ): Promise<{ data: unknown; message: string }> {
    const data = await this.service.vehicleCostSummary(req.user, vehicleId, query);
    return { data, message: "Vehicle cost summary fetched" };
  }
}