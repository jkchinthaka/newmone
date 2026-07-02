import { Controller, Get, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { FraudControlService } from "./fraud-control.service";

type AuthedRequest = { user: JwtPayload };

const FRAUD_REPORT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "INVENTORY_KEEPER",
  "FINANCE_APPROVER"
] as const;

@ApiTags("Fraud Control")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("reports/fraud-control")
export class FraudControlController {
  constructor(private readonly fraudControlService: FraudControlService) {}

  @Get("dashboard")
  @Roles(...FRAUD_REPORT_ROLES, "SUPERVISOR", "SECURITY_OFFICER")
  async dashboard(@Req() req: AuthedRequest) {
    const data = await this.fraudControlService.getDashboard(req.user);
    return { data, message: "Fraud control dashboard fetched" };
  }

  @Get("admin-overrides")
  @Roles(...FRAUD_REPORT_ROLES)
  async adminOverrides(
    @Req() req: AuthedRequest,
    @Query()
    query: {
      dateFrom?: string;
      dateTo?: string;
      module?: string;
      actorId?: string;
      role?: string;
      overrideType?: string;
      riskSeverity?: string;
      branch?: string;
      departmentId?: string;
      limit?: string;
    }
  ) {
    const data = await this.fraudControlService.listAdminOverrides(req.user, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      module: query.module,
      actorId: query.actorId,
      role: query.role,
      overrideType: query.overrideType,
      riskSeverity: query.riskSeverity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
      branch: query.branch,
      departmentId: query.departmentId,
      limit: query.limit ? Number(query.limit) : undefined
    });
    return { data, message: "Admin override report fetched" };
  }

  @Get("admin-overrides/export")
  @Roles(...FRAUD_REPORT_ROLES)
  async exportAdminOverrides(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query()
    query: {
      dateFrom?: string;
      dateTo?: string;
      module?: string;
      actorId?: string;
      role?: string;
      overrideType?: string;
      riskSeverity?: string;
      limit?: string;
    }
  ) {
    const file = await this.fraudControlService.exportAdminOverrides(req.user, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      module: query.module,
      actorId: query.actorId,
      role: query.role,
      overrideType: query.overrideType,
      riskSeverity: query.riskSeverity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined,
      limit: query.limit ? Number(query.limit) : undefined
    });
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }

  @Get("parts-misuse")
  @Roles(...FRAUD_REPORT_ROLES, "SUPERVISOR")
  async partsMisuse(@Req() req: AuthedRequest) {
    const data = await this.fraudControlService.listPartsMisuse(req.user);
    return { data, message: "Parts misuse report fetched" };
  }
}
