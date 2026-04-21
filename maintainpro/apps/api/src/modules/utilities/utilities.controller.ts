import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { UtilitiesService } from "./utilities.service";

@ApiTags("Utilities")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("utilities")
export class UtilitiesController {
  constructor(private readonly utilitiesService: UtilitiesService) {}

  @Get("meters")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async meters() {
    const data = await this.utilitiesService.meters();
    return { data, message: "Meters fetched" };
  }

  @Post("meters")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async createMeter(@Body() body: { meterNumber: string; type: "ELECTRICITY" | "WATER" | "GAS"; location: string; description?: string; unit: string }) {
    const data = await this.utilitiesService.createMeter(body);
    return { data, message: "Meter created" };
  }

  @Get("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async meter(@Param("id") id: string) {
    const data = await this.utilitiesService.meter(id);
    return { data, message: "Meter fetched" };
  }

  @Patch("meters/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async updateMeter(@Param("id") id: string, @Body() body: Partial<{ location: string; description: string; unit: string; isActive: boolean }>) {
    const data = await this.utilitiesService.updateMeter(id, body);
    return { data, message: "Meter updated" };
  }

  @Post("meters/:id/readings")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async addReading(@Param("id") id: string, @Body() body: { readingDate: string; readingValue: number; images?: string[]; notes?: string }) {
    const data = await this.utilitiesService.addReading(id, body);
    return { data, message: "Reading created" };
  }

  @Get("meters/:id/readings")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async readings(@Param("id") id: string) {
    const data = await this.utilitiesService.readings(id);
    return { data, message: "Readings fetched" };
  }

  @Get("meters/:id/consumption-chart")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async consumptionChart(@Param("id") id: string) {
    const data = await this.utilitiesService.consumptionChart(id);
    return { data, message: "Consumption chart fetched" };
  }

  @Get("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async bills() {
    const data = await this.utilitiesService.bills();
    return { data, message: "Bills fetched" };
  }

  @Post("bills")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async createBill(
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
    const data = await this.utilitiesService.createBill(body);
    return { data, message: "Bill created" };
  }

  @Get("bills/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async bill(@Param("id") id: string) {
    const data = await this.utilitiesService.bill(id);
    return { data, message: "Bill fetched" };
  }

  @Patch("bills/:id/pay")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async pay(@Param("id") id: string) {
    const data = await this.utilitiesService.payBill(id);
    return { data, message: "Bill paid" };
  }

  @Get("bills/overdue")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER")
  async overdue() {
    const data = await this.utilitiesService.overdue();
    return { data, message: "Overdue bills fetched" };
  }

  @Get("analytics")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async analytics() {
    const data = await this.utilitiesService.analytics();
    return { data, message: "Utilities analytics fetched" };
  }
}
