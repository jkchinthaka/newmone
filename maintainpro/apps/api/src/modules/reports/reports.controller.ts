import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Permissions } from "../../common/decorators/permissions.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScoped } from "../../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { spreadsheetCell } from "./maintenance-cost.rollup";
import { contentDispositionAttachment } from "./report-export-safety.util";
import { assertReportModuleKey, parseExportFormat, parseValidatedReportQuery } from "./report-query.dto";
import { ReportExportFormat, ReportModuleKey, ReportQuery, ReportsService } from "./reports.service";
import { ErpMonitoringService } from "./erp-monitoring.service";
import { ReportTemplatesService } from "./report-templates.service";
import type { ReportTemplateDefinition } from "./report-kpi";
import { MaintenanceCostQueryService } from "./maintenance-cost.query";

type AuthedRequest = { user: JwtPayload };

const REPORT_READ_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "FLEET_MANAGER",
  "SUPERVISOR",
  "FINANCE",
  "PROCUREMENT_OFFICER",
  "INVENTORY_KEEPER",
  "TECHNICIAN",
  "MECHANIC",
  "VIEWER",
  "DRIVER"
] as const;

@ApiTags("Reports")
@ApiBearerAuth()
@TenantScoped()
@UseGuards(JwtAuthGuard)
@Controller("reports")
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly maintenanceCosts: MaintenanceCostQueryService,
    private readonly erpMonitoringService: ErpMonitoringService,
    private readonly reportTemplates: ReportTemplatesService
  ) {}

  @Get("maintenance-costs/export")
  @Roles(...REPORT_READ_ROLES)
  @Permissions("reports.view")
  async exportMaintenanceCosts(@Req() req: AuthedRequest, @Query() query: Record<string, string>, @Res() res: Response) {
    const result = await this.maintenanceCosts.list(req.user, { ...query, page: "1", pageSize: "5000" });
    const header = ["WO number", "Title", "Status", "Asset", "Period parts", "Period labour", "Period services", "Period total", "Currency", "Completeness", "Lifetime actual", "Variance amount", "Variance percent", "Variance label"];
    const lines = [
      header.join(","),
      ...result.items.map((job) =>
        [
          job.woNumber,
          job.title,
          job.status,
          job.asset,
          job.period.parts,
          job.period.labour,
          job.period.services,
          job.period.actual,
          job.period.currency,
          job.period.complete ? "Complete" : "Partial",
          job.lifetime.actual,
          job.lifetime.variance.amount,
          job.lifetime.variance.percent,
          job.lifetime.variance.label
        ].map((cell) => spreadsheetCell(cell)).join(",")
      )
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", contentDispositionAttachment("maintenance-costs.csv"));
    res.send(lines.join("\n"));
  }

  @Get("maintenance-costs")
  @Roles(...REPORT_READ_ROLES)
  @Permissions("reports.view")
  async maintenanceCostsReport(@Req() req: AuthedRequest, @Query() query: Record<string, string>) {
    const result = await this.maintenanceCosts.list(req.user, query);
    return {
      data: { items: result.items, summary: result.summary, evaluatedAt: result.evaluatedAt },
      meta: { page: result.page, limit: result.pageSize, total: result.total, totalPages: result.total === 0 ? 0 : Math.ceil(result.total / result.pageSize) },
      message: "Maintenance costs"
    };
  }

  @Get("options")
  @Roles(...REPORT_READ_ROLES)
  async options(@Req() req: AuthedRequest) {
    const data = await this.reportsService.options(req.user);
    return { data, message: "Report filter options fetched" };
  }

  @Get("dashboard")
  @Roles(...REPORT_READ_ROLES)
  async dashboard(@Req() req: AuthedRequest, @Query() query: ReportQuery) {
    const data = await this.reportsService.dashboard(req.user, parseValidatedReportQuery(query));
    return { data, message: "Reports dashboard fetched" };
  }

  @Get("erp-monitoring")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "FINANCE", "PROCUREMENT_OFFICER")
  async erpMonitoring(@Req() req: AuthedRequest) {
    const data = await this.erpMonitoringService.getSafeSummary(req.user.tenantId ?? null);
    return { data, message: "ERP monitoring summary fetched" };
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

  @Get("templates")
  @Roles(...REPORT_READ_ROLES)
  async templates(@Req() req: AuthedRequest) {
    const data = await this.reportTemplates.list(req.user);
    return { data, message: "Report templates fetched" };
  }

  @Post("templates")
  @Roles("SUPER_ADMIN", "ADMIN")
  async saveTemplate(@Req() req: AuthedRequest, @Body() body: Partial<ReportTemplateDefinition>) {
    const data = await this.reportTemplates.save(req.user, body);
    return { data, message: "Report template saved" };
  }

  @Get(":module/export")
  @Roles(...REPORT_READ_ROLES)
  async exportModule(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("module") module: string,
    @Query("format") formatRaw?: ReportExportFormat,
    @Query() query?: ReportQuery
  ) {
    assertReportModuleKey(module);
    const format = parseExportFormat(formatRaw);
    const file = await this.reportsService.exportModule(
      req.user,
      module as ReportModuleKey,
      format,
      parseValidatedReportQuery(query ?? {})
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", contentDispositionAttachment(file.filename));
    if (file.truncated) {
      res.setHeader("X-Export-Truncated", "true");
      res.setHeader("X-Export-Row-Count", String(file.exportedRowCount ?? 0));
      res.setHeader("X-Export-Total-Matched", String(file.totalMatchedCount ?? 0));
    }
    res.send(file.buffer);
  }

  @Get(":module")
  @Roles(...REPORT_READ_ROLES)
  async moduleReport(
    @Req() req: AuthedRequest,
    @Param("module") module: string,
    @Query() query: ReportQuery
  ) {
    assertReportModuleKey(module);
    const data = await this.reportsService.moduleReport(
      req.user,
      module as ReportModuleKey,
      parseValidatedReportQuery(query)
    );
    return { data, message: "Report fetched" };
  }
}
