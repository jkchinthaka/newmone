import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ReportExportFormat, ReportModuleKey, ReportQuery, ReportsService } from "./reports.service";

type AuthedRequest = { user: JwtPayload };

const REPORT_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "INVENTORY_KEEPER",
  "VIEWER"
] as const;

@ApiTags("Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("options")
  @Roles(...REPORT_READ_ROLES)
  async options(@Req() req: AuthedRequest) {
    const data = await this.reportsService.options(req.user);
    return { data, message: "Report filter options fetched" };
  }

  @Get("dashboard")
  @Roles(...REPORT_READ_ROLES)
  async dashboard(@Req() req: AuthedRequest, @Query() query: ReportQuery) {
    const data = await this.reportsService.dashboard(req.user, this.parseQuery(query));
    return { data, message: "Reports dashboard fetched" };
  }

  @Get("maintenance-cost")
  @Roles(...REPORT_READ_ROLES)
  async maintenanceCost(@Req() req: AuthedRequest) {
    const data = await this.reportsService.maintenanceCost(req.user);
    return { data, message: "Maintenance cost report fetched" };
  }

  @Get("fleet-efficiency")
  @Roles(...REPORT_READ_ROLES)
  async fleetEfficiency(@Req() req: AuthedRequest) {
    const data = await this.reportsService.fleetEfficiency(req.user);
    return { data, message: "Fleet efficiency report fetched" };
  }

  @Get("downtime")
  @Roles(...REPORT_READ_ROLES)
  async downtime(@Req() req: AuthedRequest) {
    const data = await this.reportsService.downtime(req.user);
    return { data, message: "Downtime report fetched" };
  }

  @Get("work-orders")
  @Roles(...REPORT_READ_ROLES)
  async workOrders(@Req() req: AuthedRequest) {
    const data = await this.reportsService.workOrders(req.user);
    return { data, message: "Work order report fetched" };
  }

  @Get("inventory")
  @Roles(...REPORT_READ_ROLES)
  async inventory(@Req() req: AuthedRequest) {
    const data = await this.reportsService.inventory(req.user);
    return { data, message: "Inventory report fetched" };
  }

  @Get("utilities")
  @Roles(...REPORT_READ_ROLES)
  async utilities(@Req() req: AuthedRequest) {
    const data = await this.reportsService.utilities(req.user);
    return { data, message: "Utilities report fetched" };
  }

  @Get(":module/export")
  @Roles(...REPORT_READ_ROLES)
  async exportModule(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("module") module: ReportModuleKey,
    @Query("format") formatRaw?: ReportExportFormat,
    @Query() query?: ReportQuery
  ) {
    const format = formatRaw && ["csv", "xlsx", "pdf"].includes(formatRaw) ? formatRaw : "csv";
    const file = await this.reportsService.exportModule(req.user, module, format, this.parseQuery(query ?? {}));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Get(":module")
  @Roles(...REPORT_READ_ROLES)
  async moduleReport(
    @Req() req: AuthedRequest,
    @Param("module") module: ReportModuleKey,
    @Query() query: ReportQuery
  ) {
    const data = await this.reportsService.moduleReport(req.user, module, this.parseQuery(query));
    return { data, message: "Report fetched" };
  }

  private parseQuery(query: ReportQuery): ReportQuery {
    return {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      sortDirection: query.sortDirection === "asc" ? "asc" : query.sortDirection === "desc" ? "desc" : undefined
    };
  }
}