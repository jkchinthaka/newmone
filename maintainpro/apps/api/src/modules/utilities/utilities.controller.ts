import { Permissions } from "../../common/decorators/permissions.decorator";
import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { METER_READING_ROLES } from "./meter-reading-rules";
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
  @Roles(...METER_READING_ROLES)
  @Permissions("access.utilitiescontroller.meters")
  async meters(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.meters(req.user?.tenantId ?? null);
    return { data, message: "Meters fetched" };
  }

  @Post("meters")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.createmeter")
  async createMeter(
    @Req() req: AuthedRequest,
    @Body() body: { meterNumber: string; type: "ELECTRICITY" | "WATER" | "GAS"; location: string; description?: string; unit: string }
  ) {
    const data = await this.utilitiesService.createMeter(req.user?.tenantId ?? null, body);
    return { data, message: "Meter created" };
  }

  @Get("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  @Permissions("access.utilitiescontroller.meter")
  async meter(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.meter(id, req.user?.tenantId ?? null);
    return { data, message: "Meter fetched" };
  }

  @Patch("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.updatemeter")
  async updateMeter(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: Partial<{ location: string; description: string; unit: string; isActive: boolean }>
  ) {
    const data = await this.utilitiesService.updateMeter(id, req.user?.tenantId ?? null, body);
    return { data, message: "Meter updated" };
  }

  @Post("meters/:id/readings")
  @Roles(...METER_READING_ROLES)
  @Permissions("access.utilitiescontroller.addreading")
  async addReading(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { readingDate: string; readingValue: unknown; images?: string[]; notes?: string; resetReason?: string; idempotencyKey?: string },
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const data = await this.utilitiesService.addReading(id, req.user?.tenantId ?? null, {
      ...body,
      idempotencyKey: idempotencyKey || body.idempotencyKey,
      recordedBy: req.user?.sub
    });
    return { data, message: "Reading created" };
  }

  @Get("meters/:id/readings")
  @Roles(...METER_READING_ROLES)
  @Permissions("access.utilitiescontroller.readings")
  async readings(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.readings(id, req.user?.tenantId ?? null);
    return { data, message: "Readings fetched" };
  }

  @Get("readings")
  @Roles(...METER_READING_ROLES)
  @Permissions("access.utilitiescontroller.allreadings")
  async allReadings(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.allReadings(req.user?.tenantId ?? null);
    return { data, message: "Readings fetched" };
  }

  @Post("readings")
  @Roles(...METER_READING_ROLES)
  @Permissions("access.utilitiescontroller.addreadingbymeter")
  async addReadingByMeter(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      meterId: string;
      readingDate: string;
      readingValue: unknown;
      images?: string[];
      notes?: string;
      resetReason?: string;
      idempotencyKey?: string;
    },
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const data = await this.utilitiesService.addReading(body.meterId, req.user?.tenantId ?? null, {
      ...body,
      idempotencyKey: idempotencyKey || body.idempotencyKey,
      recordedBy: req.user?.sub
    });
    return { data, message: "Reading created" };
  }

  @Get("meters/:id/consumption-chart")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  @Permissions("access.utilitiescontroller.consumptionchart")
  async consumptionChart(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.consumptionChart(id, req.user?.tenantId ?? null);
    return { data, message: "Consumption chart fetched" };
  }

  @Get("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  @Permissions("access.utilitiescontroller.bills")
  async bills(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.bills(req.user?.tenantId ?? null);
    return { data, message: "Bills fetched" };
  }

  @Post("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.createbill")
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
  @Permissions("access.utilitiescontroller.bill")
  async bill(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.bill(id, req.user?.tenantId ?? null);
    return { data, message: "Bill fetched" };
  }

  @Patch("bills/:id/pay")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.pay")
  async pay(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.payBill(id, req.user?.tenantId ?? null);
    return { data, message: "Bill paid" };
  }

  @Patch("bills/pay")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.paybybody")
  async payByBody(@Req() req: AuthedRequest, @Body() body: { id: string }) {
    if (!body.id) {
      throw new BadRequestException("Bill id is required");
    }

    const data = await this.utilitiesService.payBill(body.id, req.user?.tenantId ?? null);
    return { data, message: "Bill paid" };
  }

  @Get("bills/overdue")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  @Permissions("access.utilitiescontroller.overdue")
  async overdue(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.overdue(req.user?.tenantId ?? null);
    return { data, message: "Overdue bills fetched" };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  @Permissions("access.utilitiescontroller.analytics")
  async analytics(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.analytics(req.user?.tenantId ?? null);
    return { data, message: "Utilities analytics fetched" };
  }
}
