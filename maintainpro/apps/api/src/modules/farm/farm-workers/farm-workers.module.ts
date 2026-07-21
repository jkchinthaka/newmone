import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { assertTenantEntityExists, requireTenantId } from "../../../common/utils/tenant-scope.util";
import { PrismaService } from "../../../database/prisma.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

@Injectable()
export class FarmWorkersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, status?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.farmWorker.findMany({
      where: { tenantId: scopedTenantId, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.farmWorker.findFirst({
      where: { id, tenantId: scopedTenantId },
      include: { attendanceLogs: { take: 30, orderBy: { date: "desc" } } }
    });
  }

  create(tenantId: string | null, data: Prisma.FarmWorkerUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.farmWorker.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.FarmWorkerUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmWorker, id, { tenantId: scopedTenantId, entityName: "Worker" });
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.farmWorker.update({ where: { id }, data: safe as Prisma.FarmWorkerUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.farmWorker, id, { tenantId: scopedTenantId, entityName: "Worker" });
    return this.prisma.farmWorker.delete({ where: { id } });
  }

  // Attendance
  async listAttendance(workerId: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    // The worker must belong to the active tenant before its attendance is exposed.
    await assertTenantEntityExists(this.prisma.farmWorker, workerId, { tenantId: scopedTenantId, entityName: "Worker" });
    return this.prisma.attendanceLog.findMany({
      where: { workerId, tenantId: scopedTenantId },
      orderBy: { date: "desc" }
    });
  }

  listAttendanceByTenant(tenantId: string | null, dateFrom?: string, dateTo?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.attendanceLog.findMany({
      where: {
        tenantId: scopedTenantId,
        date: dateFrom || dateTo ? { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(dateTo) : undefined } : undefined
      },
      orderBy: { date: "desc" },
      include: { worker: { select: { id: true, name: true, workerType: true } } }
    });
  }

  async recordAttendance(tenantId: string | null, data: Prisma.AttendanceLogUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!data.workerId) {
      throw new BadRequestException("workerId is required");
    }
    // Cross-tenant FK validation: the worker must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.farmWorker, data.workerId, { tenantId: scopedTenantId, entityName: "Worker" });
    return this.prisma.attendanceLog.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async updateAttendance(id: string, tenantId: string | null, data: Prisma.AttendanceLogUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.attendanceLog, id, { tenantId: scopedTenantId, entityName: "Attendance log" });
    if (typeof data.workerId === "string" && data.workerId) {
      await assertTenantEntityExists(this.prisma.farmWorker, data.workerId, { tenantId: scopedTenantId, entityName: "Worker" });
    }
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.attendanceLog.update({ where: { id }, data: safe as Prisma.AttendanceLogUncheckedUpdateInput });
  }
}

@ApiTags("Farm / Workers")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/workers")
export class FarmWorkersController {
  constructor(private readonly service: FarmWorkersService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async list(@Req() req: AuthedRequest, @Query("status") status?: string) {
    const data = await this.service.list(req.user?.tenantId ?? null, status);
    return { data, message: "Workers fetched" };
  }

  @Get("attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async tenantAttendance(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listAttendanceByTenant(req.user?.tenantId ?? null, from, to);
    return { data, message: "Attendance logs fetched" };
  }

  @Post("attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async recordAttendance(@Req() req: AuthedRequest, @Body() body: Prisma.AttendanceLogUncheckedCreateInput) {
    const data = await this.service.recordAttendance(req.user?.tenantId ?? null, body);
    return { data, message: "Attendance recorded" };
  }

  @Patch("attendance/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async updateAttendance(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.AttendanceLogUncheckedUpdateInput) {
    const data = await this.service.updateAttendance(id, req.user?.tenantId ?? null, body);
    return { data, message: "Attendance updated" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Worker fetched" };
  }

  @Get(":id/attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async listAttendance(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.listAttendance(id, req.user?.tenantId ?? null);
    return { data, message: "Worker attendance fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.FarmWorkerUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Worker created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.FarmWorkerUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Worker updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Worker removed" };
  }
}

@Module({
  controllers: [FarmWorkersController],
  providers: [FarmWorkersService],
  exports: [FarmWorkersService]
})
export class FarmWorkersModule {}
