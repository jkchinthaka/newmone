import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { CreateWorkforceEmployeeDto, UpdateWorkforceEmployeeDto } from "./dto/workforce-employee.dto";
import { WorkforceEmployeesService } from "./workforce-employees.service";
import { WorkforcePlanningService } from "./workforce-planning.service";

type AuthedRequest = { user: JwtPayload };

const WORKFORCE_EMPLOYEE_MANAGERS = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER"
] as const;

const WORKFORCE_EMPLOYEE_READERS = [
  ...WORKFORCE_EMPLOYEE_MANAGERS,
  "ASSET_MANAGER",
  "MECHANIC"
] as const;

@ApiTags("Workforce")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("workforce")
export class WorkforceController {
  constructor(
    private readonly workforcePlanning: WorkforcePlanningService,
    private readonly workforceEmployees: WorkforceEmployeesService
  ) {}

  @Get("employees")
  @Roles(...WORKFORCE_EMPLOYEE_READERS)
  async listEmployees(
    @Req() req: AuthedRequest,
    @Query("designation") designation?: string,
    @Query("q") q?: string,
    @Query("departmentId") departmentId?: string,
    @Query("branchName") branchName?: string,
    @Query("active") active?: string,
    @Query("pageSize") pageSize?: string
  ) {
    const forAssignment = designation !== undefined && !q && !departmentId && !branchName && active === undefined;

    if (forAssignment) {
      const data = await this.workforcePlanning.listEmployeesByDesignation(req.user.tenantId, designation);
      return { data, message: "Workforce employees fetched" };
    }

    const data = await this.workforceEmployees.findAll(req.user.tenantId, {
      q,
      designation,
      departmentId,
      branchName,
      active: active === undefined ? undefined : active === "true",
      pageSize: pageSize ? Number(pageSize) : undefined
    });
    return { data, message: "Workforce employees fetched" };
  }

  @Get("employees/:id")
  @Roles(...WORKFORCE_EMPLOYEE_READERS)
  async getEmployee(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.workforceEmployees.findOne(req.user.tenantId, id);
    return { data, message: "Workforce employee fetched" };
  }

  @Post("employees")
  @Roles(...WORKFORCE_EMPLOYEE_MANAGERS)
  async createEmployee(@Req() req: AuthedRequest, @Body() body: CreateWorkforceEmployeeDto) {
    const data = await this.workforceEmployees.create(req.user.tenantId ?? null, body);
    return { data, message: "Workforce employee created" };
  }

  @Put("employees/:id")
  @Roles(...WORKFORCE_EMPLOYEE_MANAGERS)
  async updateEmployee(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: UpdateWorkforceEmployeeDto
  ) {
    const data = await this.workforceEmployees.update(req.user.tenantId ?? null, id, body);
    return { data, message: "Workforce employee updated" };
  }

  @Get("assignment-preview")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER")
  async assignmentPreview(
    @Req() req: AuthedRequest,
    @Query("employeeId") employeeId: string,
    @Query("plannedStartAt") plannedStartAt?: string,
    @Query("plannedEndAt") plannedEndAt?: string,
    @Query("estimatedHours") estimatedHours?: string
  ) {
    const data = await this.workforcePlanning.previewAssignment({
      tenantId: req.user.tenantId,
      employeeId,
      plannedStartAt,
      plannedEndAt,
      estimatedHours: estimatedHours ? Number(estimatedHours) : undefined
    });
    return { data, message: "Assignment preview fetched" };
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
