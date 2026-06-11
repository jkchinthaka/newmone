import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UtilitiesService } from "./utilities.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

@ApiTags("Utilities")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("utilities")
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  @Get("meters")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async meters(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.meters(req.user?.tenantId ?? null);
    return { data, message: "Meters fetched" };
  }

  @Post("meters")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async createMeter(
    @Req() req: AuthedRequest,
    @Body() body: { meterNumber: string; type: "ELECTRICITY" | "WATER" | "GAS"; location: string; description?: string; unit: string }
  ) {
    const data = await this.utilitiesService.createMeter(req.user?.tenantId ?? null, body);
    return { data, message: "Meter created" };
  }

  @Get("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async meter(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.meter(id, req.user?.tenantId ?? null);
    return { data, message: "Meter fetched" };
  }

  @Patch("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async updateMeter(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ location: string; description: string; unit: string; isActive: boolean }>
  ) {
    const data = await this.utilitiesService.updateMeter(id, req.user?.tenantId ?? null, body);
    return { data, message: "Meter updated" };
  }

  @Post("meters/:id/readings")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async addReading(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { readingDate: string; readingValue: number; images?: string[]; notes?: string }
  ) {
    const data = await this.utilitiesService.addReading(id, req.user?.tenantId ?? null, body);
    return { data, message: "Reading created" };
  }

  @Get("meters/:id/readings")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async readings(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.readings(id, req.user?.tenantId ?? null);
    return { data, message: "Readings fetched" };
  }

  @Get("readings")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async allReadings(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.allReadings(req.user?.tenantId ?? null);
    return { data, message: "Readings fetched" };
  }

  @Post("readings")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async addReadingByMeter(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      meterId: string;
      readingDate: string;
      readingValue: number;
      images?: string[];
      notes?: string;
    }
  ) {
    const data = await this.utilitiesService.addReading(body.meterId, req.user?.tenantId ?? null, {
      readingDate: body.readingDate,
      readingValue: body.readingValue,
      images: body.images,
      notes: body.notes
    });
    return { data, message: "Reading created" };
  }

  @Get("meters/:id/consumption-chart")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async consumptionChart(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.consumptionChart(id, req.user?.tenantId ?? null);
    return { data, message: "Consumption chart fetched" };
  }

  @Get("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async bills(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.bills(req.user?.tenantId ?? null);
    return { data, message: "Bills fetched" };
  }

  @Post("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async createBill(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      meterId: string;
      billingPeriodStart: string;
      billingPeriodEnd: string;
      totalConsumption: number;
      ratePerUnit: number;
      baseCharge?: number;
      taxAmount?: number;
      dueDate?: string;
      notes?: string;
    }
  ) {
    const data = await this.utilitiesService.createBill(req.user?.tenantId ?? null, body);
    return { data, message: "Bill created" };
  }

  @Get("bills/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async bill(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.bill(id, req.user?.tenantId ?? null);
    return { data, message: "Bill fetched" };
  }

  @Patch("bills/:id/pay")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async pay(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.payBill(id, req.user?.tenantId ?? null);
    return { data, message: "Bill paid" };
  }

  @Patch("bills/pay")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async payByBody(@Req() req: AuthedRequest, @Body() body: { id: string }) {
    if (!body.id) {
      throw new BadRequestException("Bill id is required");
    }

    const data = await this.utilitiesService.payBill(body.id, req.user?.tenantId ?? null);
    return { data, message: "Bill paid" };
  }

  @Get("bills/overdue")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async overdue(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.overdue(req.user?.tenantId ?? null);
    return { data, message: "Overdue bills fetched" };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async analytics(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.analytics(req.user?.tenantId ?? null);
    return { data, message: "Utilities analytics fetched" };
  }
}
