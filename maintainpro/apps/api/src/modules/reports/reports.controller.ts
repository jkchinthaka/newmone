import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ReportsService } from "./reports.service";

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("dashboard")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async dashboard() {
    const data = await this.reportsService.dashboard();
    return { data, message: "Dashboard report fetched" };
  }

  @Get("maintenance-cost")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async maintenanceCost() {
    const data = await this.reportsService.maintenanceCost();
    return { data, message: "Maintenance cost report fetched" };
  }

  @Get("fleet-efficiency")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async fleetEfficiency() {
    const data = await this.reportsService.fleetEfficiency();
    return { data, message: "Fleet efficiency report fetched" };
  }

  @Get("downtime")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async downtime() {
    const data = await this.reportsService.downtime();
    return { data, message: "Downtime report fetched" };
  }

  @Get("work-orders")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async workOrders() {
    const data = await this.reportsService.workOrders();
    return { data, message: "Work order report fetched" };
  }

  @Get("inventory")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async inventory() {
    const data = await this.reportsService.inventory();
    return { data, message: "Inventory report fetched" };
  }

  @Get("utilities")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "VIEWER")
  async utilities() {
    const data = await this.reportsService.utilities();
    return { data, message: "Utilities report fetched" };
  }
}
