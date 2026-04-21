import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { MaintenanceService } from "./maintenance.service";

@ApiTags("Maintenance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("maintenance")
export class MaintenanceController {
  constructor(
    @Inject(MaintenanceService)
    private readonly maintenanceService: MaintenanceService
  ) {}

  @Get("schedules")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async schedules() {
    const data = await this.maintenanceService.schedules();
    return { data, message: "Schedules fetched" };
  }

  @Post("schedules")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async createSchedule(
    @Body()
    body: {
      name: string;
      description?: string;
      type: "PREVENTIVE" | "PREDICTIVE" | "CORRECTIVE" | "INSPECTION";
      frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL" | "MILEAGE_BASED" | "CUSTOM";
      intervalDays?: number;
      intervalMileage?: number;
      assetId?: string;
      vehicleId?: string;
      nextDueDate?: string;
      nextDueMileage?: number;
      estimatedCost?: number;
      estimatedHours?: number;
    }
  ) {
    const data = await this.maintenanceService.createSchedule(body);
    return { data, message: "Schedule created" };
  }

  @Get("schedules/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async schedule(@Param("id") id: string) {
    const data = await this.maintenanceService.schedule(id);
    return { data, message: "Schedule fetched" };
  }

  @Patch("schedules/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async updateSchedule(
    @Param("id") id: string,
    @Body()
    body: Partial<{
      name: string;
      description: string;
      type: "PREVENTIVE" | "PREDICTIVE" | "CORRECTIVE" | "INSPECTION";
      frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "BIANNUAL" | "ANNUAL" | "MILEAGE_BASED" | "CUSTOM";
      intervalDays: number;
      intervalMileage: number;
      nextDueDate: string;
      nextDueMileage: number;
      estimatedCost: number;
      estimatedHours: number;
      isActive: boolean;
    }>
  ) {
    const data = await this.maintenanceService.updateSchedule(id, body);
    return { data, message: "Schedule updated" };
  }

  @Delete("schedules/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER")
  async removeSchedule(@Param("id") id: string) {
    const data = await this.maintenanceService.removeSchedule(id);
    return { data, message: "Schedule deleted" };
  }

  @Get("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async logs() {
    const data = await this.maintenanceService.logs();
    return { data, message: "Logs fetched" };
  }

  @Post("logs")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async createLog(
    @Body()
    body: {
      scheduleId?: string;
      assetId?: string;
      vehicleId?: string;
      workOrderId?: string;
      description: string;
      performedBy: string;
      performedAt: string;
      cost?: number;
      notes?: string;
      attachments?: string[];
    }
  ) {
    const data = await this.maintenanceService.createLog(body);
    return { data, message: "Log created" };
  }

  @Get("calendar")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC", "SUPERVISOR")
  async calendar() {
    const data = await this.maintenanceService.calendar();
    return { data, message: "Maintenance calendar fetched" };
  }

  @Get("predictive-alerts")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async predictiveAlerts() {
    const data = await this.maintenanceService.predictiveAlerts();
    return { data, message: "Predictive alerts fetched" };
  }

  @Post("predictive-alerts/:id/acknowledge")
  @Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")
  async acknowledgePredictive(@Param("id") id: string) {
    const data = await this.maintenanceService.acknowledgePredictiveAlert(id);
    return { data, message: "Predictive alert acknowledged" };
  }
}
