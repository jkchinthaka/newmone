import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { WorkforcePlanningService } from "./workforce-planning.service";

type AuthedRequest = { user: JwtPayload };

@ApiTags("Workforce")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("workforce")
export class WorkforceController {
  constructor(private readonly workforcePlanning: WorkforcePlanningService) {}

  @Get("employees")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  async listEmployees(@Req() req: AuthedRequest, @Query("designation") designation?: string) {
    const data = await this.workforcePlanning.listEmployeesByDesignation(req.user.tenantId, designation);
    return { data, message: "Workforce employees fetched" };
  }

  @Get("workload-summary")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  async workloadSummary(
    @Req() req: AuthedRequest,
    @Query("designation") designation?: string,
    @Query("departmentId") departmentId?: string,
    @Query("branchName") branchName?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("overdueOnly") overdueOnly?: string
  ) {
    const data = await this.workforcePlanning.getWorkloadSummary(req.user, {
      designation,
      departmentId,
      branchName,
      from,
      to,
      overdueOnly: overdueOnly === "true"
    });
    return { data, message: "Workforce workload summary fetched" };
  }
}
