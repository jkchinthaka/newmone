import { Controller, Get, Param, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { TenantScoped } from "../../common/decorators/tenant-scope.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { ManagementIntelligenceService } from "./management-intelligence.service";
import type { ManagementReportKey, ManagementReportQuery } from "./management-intelligence.types";

type AuthedRequest = { user: JwtPayload };

const MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "FINANCE_APPROVER"
] as const;

const SUPERVISOR_ROLES = [...MANAGEMENT_ROLES, "SUPERVISOR"] as const;
const PARTS_ROLES = [...MANAGEMENT_ROLES, "SUPERVISOR", "INVENTORY_KEEPER"] as const;

@ApiTags("Management Intelligence")
@ApiBearerAuth()
@TenantScoped()
@UseGuards(JwtAuthGuard)
@Controller("reports/management")
export class ManagementIntelligenceController {
  constructor(private readonly managementIntelligenceService: ManagementIntelligenceService) {}

  @Get("profitability/summary")
  @Roles(...MANAGEMENT_ROLES)
  async summary(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getProfitabilitySummary(req.user, query);
    return { data, message: "Profitability summary fetched" };
  }

  @Get("cost-by-asset")
  @Roles(...MANAGEMENT_ROLES)
  async costByAsset(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getCostByAsset(req.user, query);
    return { data, message: "Cost by asset report fetched" };
  }

  @Get("cost-by-vehicle")
  @Roles(...MANAGEMENT_ROLES)
  async costByVehicle(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getCostByVehicle(req.user, query);
    return { data, message: "Cost by vehicle report fetched" };
  }

  @Get("cost-by-department")
  @Roles(...SUPERVISOR_ROLES)
  async costByDepartment(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getCostByDepartment(req.user, query);
    return { data, message: "Cost by department report fetched" };
  }

  @Get("cost-by-branch")
  @Roles(...MANAGEMENT_ROLES)
  async costByBranch(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getCostByBranch(req.user, query);
    return { data, message: "Cost by branch report fetched" };
  }

  @Get("cost-by-category")
  @Roles(...MANAGEMENT_ROLES)
  async costByCategory(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getCostByCategory(req.user, query);
    return { data, message: "Cost by category report fetched" };
  }

  @Get("top-high-cost-assets")
  @Roles(...MANAGEMENT_ROLES)
  async topAssets(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getTopHighCostAssets(req.user, query);
    return { data, message: "Top high-cost assets fetched" };
  }

  @Get("repeated-breakdowns")
  @Roles(...SUPERVISOR_ROLES)
  async repeatedBreakdowns(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getRepeatedBreakdowns(req.user, query);
    return { data, message: "Repeated breakdown report fetched" };
  }

  @Get("top-high-cost-vehicles")
  @Roles(...MANAGEMENT_ROLES)
  async topVehicles(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getTopHighCostVehicles(req.user, query);
    return { data, message: "Top high-cost vehicles fetched" };
  }

  @Get("vendor-cost-comparison")
  @Roles(...MANAGEMENT_ROLES)
  async vendorComparison(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getVendorCostComparison(req.user, query);
    return { data, message: "Vendor cost comparison fetched" };
  }

  @Get("parts-usage-by-technician")
  @Roles(...PARTS_ROLES)
  async partsByTechnician(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getPartsUsageByTechnician(req.user, query);
    return { data, message: "Parts usage by technician fetched" };
  }

  @Get("monthly-cost-trend")
  @Roles(...MANAGEMENT_ROLES)
  async monthlyTrend(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getMonthlyCostTrend(req.user, query);
    return { data, message: "Monthly maintenance cost trend fetched" };
  }

  @Get("repair-vs-replace")
  @Roles(...MANAGEMENT_ROLES)
  async repairVsReplace(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getRepairVsReplace(req.user, query);
    return { data, message: "Repair vs replace review fetched" };
  }

  @Get("downtime-cost")
  @Roles(...MANAGEMENT_ROLES)
  async downtimeCost(@Req() req: AuthedRequest, @Query() query: ManagementReportQuery) {
    const data = await this.managementIntelligenceService.getDowntimeCost(req.user, query);
    return { data, message: "Downtime cost report fetched" };
  }

  @Get(":reportKey/export")
  @Roles(...MANAGEMENT_ROLES, "SUPERVISOR", "INVENTORY_KEEPER")
  async exportReport(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Param("reportKey") reportKey: ManagementReportKey,
    @Query() query: ManagementReportQuery
  ) {
    const file = await this.managementIntelligenceService.exportReport(req.user, reportKey, query);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }
}
