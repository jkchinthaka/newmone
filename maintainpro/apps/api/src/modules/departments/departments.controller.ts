import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";

import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { JwtPayload } from "../auth/auth.types";
import { DepartmentsService } from "./departments.service";

type AuthedRequest = { user: JwtPayload };
const DEPARTMENT_MANAGE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;

@ApiTags("Departments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("departments")
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Header("Cache-Control", "private, max-age=60")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN", "VIEWER")
  @ApiQuery({ name: "q", required: false })
  @ApiQuery({ name: "parentId", required: false, description: "Pass 'null' for top-level only, or an ObjectId for children" })
  @ApiQuery({ name: "pageSize", required: false })
  @ApiQuery({ name: "includeInactive", required: false })
  @ApiQuery({ name: "exclude", required: false })
  @ApiQuery({ name: "ids", required: false, description: "Comma-separated ids to fetch" })
  async findAll(
    @Req() req: AuthedRequest,
    @Query("q") q?: string,
    @Query("parentId") parentId?: string,
    @Query("pageSize") pageSize?: string,
    @Query("includeInactive") includeInactive?: string,
    @Query("exclude") exclude?: string,
    @Query("ids") ids?: string
  ) {
    const data = await this.departmentsService.findAll(req.user?.tenantId ?? null, {
      q,
      parentId,
      pageSize: pageSize ? Number(pageSize) : undefined,
      includeInactive: includeInactive === "true",
      exclude,
      ids: ids?.split(",").map((id) => id.trim()).filter(Boolean)
    });
    return { data, message: "Departments fetched" };
  }

  @Get(":id")
  @Header("Cache-Control", "private, max-age=60")
  @Roles("SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "SUPERVISOR", "MECHANIC", "TECHNICIAN", "VIEWER")
  async findOne(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.departmentsService.findOne(req.user?.tenantId ?? null, id);
    return { data, message: "Department fetched" };
  }

  @Post()
  @Roles(...DEPARTMENT_MANAGE_ROLES)
  async create(
    @Req() req: AuthedRequest,
    @Body() body: { name?: string; code?: string; description?: string; parentId?: string; managerId?: string }
  ) {
    if (!body.name?.trim()) throw new BadRequestException("`name` is required");
    const data = await this.departmentsService.create(req.user?.tenantId ?? null, {
      name: body.name,
      code: body.code,
      description: body.description,
      parentId: body.parentId || null,
      managerId: body.managerId || null
    });
    return { data, message: "Department created" };
  }

  @Patch(":id")
  @Roles(...DEPARTMENT_MANAGE_ROLES)
  async update(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { name?: string; code?: string; description?: string; parentId?: string | null; managerId?: string | null; isActive?: boolean }
  ) {
    const data = await this.departmentsService.update(req.user?.tenantId ?? null, id, body);
    return { data, message: "Department updated" };
  }

  @Put(":id")
  @Roles(...DEPARTMENT_MANAGE_ROLES)
  async replace(
    @Req() req: AuthedRequest,
    @Param("id") id: string,
    @Body() body: { name?: string; code?: string; description?: string; parentId?: string | null; managerId?: string | null; isActive?: boolean; status?: "active" | "inactive" | "ACTIVE" | "INACTIVE" }
  ) {
    if (!body.name?.trim()) throw new BadRequestException("`name` is required");
    const data = await this.departmentsService.update(req.user?.tenantId ?? null, id, body);
    return { data, message: "Department updated" };
  }

  @Patch(":id/deactivate")
  @Roles(...DEPARTMENT_MANAGE_ROLES)
  async deactivate(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.departmentsService.deactivate(req.user?.tenantId ?? null, id);
    return { data, message: "Department deactivated" };
  }

  @Delete(":id")
  @Roles(...DEPARTMENT_MANAGE_ROLES)
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.departmentsService.deactivate(req.user?.tenantId ?? null, id);
    return { data, message: "Department deactivated" };
  }
}
