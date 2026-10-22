import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { WorkOrderCategoryReportsService, type CategoryReportQuery } from "./work-order-category-reports.service";

type AuthedRequest = { user: JwtPayload };

const REPORT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "INVENTORY_KEEPER"
] as const;

@ApiTags("Work Order Category Reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports/work-orders")
export class WorkOrderCategoryReportsController {
  constructor(private readonly categoryReports: WorkOrderCategoryReportsService) {}

  @Get("category-summary")
  @Roles(...REPORT_ROLES)
  async categorySummary(@Req() req: AuthedRequest, @Query() query: CategoryReportQuery) {
    const data = await this.categoryReports.getCategorySummary(req.user, query);
    return { data, message: "Work order category summary fetched" };
  }

  @Get("category-summary/export")
  @Roles(...REPORT_ROLES)
  async exportCategorySummary(@Req() req: AuthedRequest, @Res() res: Response, @Query() query: CategoryReportQuery) {
    const file = await this.categoryReports.exportCategorySummaryCsv(req.user, query);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  @Get("top-issues")
  @Roles(...REPORT_ROLES)
  async topIssues(@Req() req: AuthedRequest, @Query() query: CategoryReportQuery & { limit?: string }) {
    const data = await this.categoryReports.getTopIssues(req.user, query, query.limit ? Number(query.limit) : 20);
    return { data, message: "Top work order issues fetched" };
  }

  @Get("triage")
  @Roles(...REPORT_ROLES)
  async triage(@Req() req: AuthedRequest, @Query() query: CategoryReportQuery) {
    const data = await this.categoryReports.getTriageReport(req.user, query);
    return { data, message: "Triage work orders report fetched" };
  }

  @Get("category-changes")
  @Roles(...REPORT_ROLES)
  async categoryChanges(@Req() req: AuthedRequest, @Query() query: CategoryReportQuery) {
    const data = await this.categoryReports.getCategoryChanges(req.user, query);
    return { data, message: "Work order category change report fetched" };
  }
}
