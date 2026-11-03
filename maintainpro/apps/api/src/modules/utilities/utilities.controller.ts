import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
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

  @Get("meters/latest-readings")
  @Roles(...METER_READING_ROLES)
  async latestReadings(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.latestReadings(req.user?.tenantId ?? null);
    return { data, message: "Latest readings fetched" };
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
  @Roles(...METER_READING_ROLES)
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
  async readings(@Req() req: AuthedRequest, @Param("id") id: string, @Query("take") take?: string) {
    const options = take === undefined ? undefined : { take: this.parseMeterTake(take) };
    const data = await this.utilitiesService.readings(id, req.user?.tenantId ?? null, options);
    return { data, message: "Readings fetched" };
  }

  @Get("readings")
  @Roles(...METER_READING_ROLES)
  async allReadings(
    @Req() req: AuthedRequest,
    @Query("mine") mine?: string,
    @Query("days") days?: string,
    @Query("take") take?: string
  ) {
    const data = await this.utilitiesService.allReadings(
      req.user?.tenantId ?? null,
      this.readingListOptions(mine, days, take, req.user?.sub)
    );
    return { data, message: "Readings fetched" };
  }

  private parseMeterTake(take: string): number {
    if (!/^\d+$/.test(take) || Number(take) < 1 || Number(take) > 50) {
      throw new BadRequestException("take must be a whole number from 1 to 50.");
    }
    return Number(take);
  }

  private readingListOptions(mine?: string, days?: string, take?: string, userId?: string) {
    if (mine === undefined && days === undefined && take === undefined) return undefined;
    const options: { mineUserId?: string; days?: number; take?: number } = {};
    if (mine !== undefined) {
      if (mine === "true" || mine === "1") {
        if (!userId) throw new BadRequestException("A signed-in user is required for mine=true.");
        options.mineUserId = userId;
      } else if (mine !== "false" && mine !== "0") {
        throw new BadRequestException("mine must be true or false.");
      }
    }
    if (days !== undefined) {
      if (!/^\d+$/.test(days) || Number(days) < 1 || Number(days) > 366) {
        throw new BadRequestException("days must be a whole number from 1 to 366.");
      }
      options.days = Number(days);
    }
    if (take !== undefined) {
      if (!/^\d+$/.test(take) || Number(take) < 1 || Number(take) > 200) {
        throw new BadRequestException("take must be a whole number from 1 to 200.");
      }
      options.take = Number(take);
    }
    return options;
  }

  @Post("readings")
  @Roles(...METER_READING_ROLES)
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
  async consumptionChart(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.utilitiesService.consumptionChart(id, req.user?.tenantId ?? null);
    return { data, message: "Consumption chart fetched" };
  }

  @Get("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async bills(@Req() req: AuthedRequest, @Query("take") take?: string, @Query("days") days?: string) {
    const data = await this.utilitiesService.bills(req.user?.tenantId ?? null, {
      take: take ? Number(take) : undefined,
      days: days ? Number(days) : undefined
    });
    return { data, message: "Bills fetched" };
  }

  // Declared before bills/:id so "overdue" is not read as a bill id.
  @Get("bills/overdue")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async overdue(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.overdue(req.user?.tenantId ?? null);
    return { data, message: "Overdue bills fetched" };
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

  @Get("analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "SUPERVISOR")
  async analytics(@Req() req: AuthedRequest) {
    const data = await this.utilitiesService.analytics(req.user?.tenantId ?? null);
    return { data, message: "Utilities analytics fetched" };
  }
}
