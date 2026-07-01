import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { MaintenanceReportsService } from "./maintenance-reports.service";
import type { MaintenanceReportQuery } from "./maintenance-reports.types";
import type { ReportQuery } from "./reports.service";

type AuthedRequest = { user: JwtPayload };

const MAINTENANCE_REPORT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "INVENTORY_KEEPER"
] as const;

const COST_REPORT_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"] as const;

@ApiTags("Maintenance Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports/maintenance")
export class MaintenanceReportsController {
  constructor(private readonly maintenanceReportsService: MaintenanceReportsService) {}

  @Get("exceptions")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async exceptions(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getExceptionsSummary(req.user, this.parseQuery(query));
    return { data, message: "Maintenance exception summary fetched" };
  }

  @Get("exceptions/:type/export")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async exportException(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("type") type: string,
    @Query() query: MaintenanceReportQuery
  ) {
    const file = await this.maintenanceReportsService.exportCsv(req.user, type, this.parseQuery(query));
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  @Get("exceptions/:type")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async exceptionDetail(@Req() req: AuthedRequest, @Param("type") type: string, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getExceptionDetail(req.user, type, this.parseQuery(query));
    return { data, message: "Maintenance exception detail fetched" };
  }

  @Get("kpis")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async kpis(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getKpis(req.user, this.parseQuery(query));
    return { data, message: "Maintenance KPIs fetched" };
  }

  @Get("costs")
  @Roles(...COST_REPORT_ROLES)
  async costs(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getCosts(req.user, this.parseQuery(query));
    return { data, message: "Maintenance cost report fetched" };
  }

  @Get("workforce")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async workforce(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getWorkforceReport(req.user, this.parseQuery(query));
    return { data, message: "Maintenance workforce report fetched" };
  }

  @Get("parts")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async parts(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getPartsReport(req.user, this.parseQuery(query));
    return { data, message: "Maintenance parts report fetched" };
  }

  @Get("assets")
  @Roles(...MAINTENANCE_REPORT_ROLES)
  async assets(@Req() req: AuthedRequest, @Query() query: MaintenanceReportQuery) {
    const data = await this.maintenanceReportsService.getAssetsReport(req.user, this.parseQuery(query));
    return { data, message: "Maintenance asset report fetched" };
  }

  @Get("risk-score/:workOrderId")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "SUPERVISOR", "INVENTORY_KEEPER", "TECHNICIAN", "MECHANIC")
  async riskScore(@Req() req: AuthedRequest, @Param("workOrderId") workOrderId: string) {
    const data = await this.maintenanceReportsService.getWorkOrderRiskScore(workOrderId, req.user);
    return { data, message: "Work order risk score fetched" };
  }

  private parseQuery(query: MaintenanceReportQuery): MaintenanceReportQuery {
    return {
      ...query,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined
    };
  }
}
