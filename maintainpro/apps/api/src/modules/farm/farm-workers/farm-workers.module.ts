import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class FarmWorkersService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, status?: string) {
    return this.prisma.farmWorker.findMany({
      where: { tenantId: tenantId ?? undefined, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  get(id: string) {
    return this.prisma.farmWorker.findUnique({ where: { id }, include: { attendanceLogs: { take: 30, orderBy: { date: "desc" } } } });
  }

  create(data: Prisma.FarmWorkerUncheckedCreateInput) {
    return this.prisma.farmWorker.create({ data });
  }

  update(id: string, data: Prisma.FarmWorkerUncheckedUpdateInput) {
    return this.prisma.farmWorker.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.farmWorker.delete({ where: { id } });
  }

  // Attendance
  listAttendance(workerId: string) {
    return this.prisma.attendanceLog.findMany({ where: { workerId }, orderBy: { date: "desc" } });
  }

  listAttendanceByTenant(tenantId: string, dateFrom?: string, dateTo?: string) {
    return this.prisma.attendanceLog.findMany({
      where: {
        tenantId,
        date: dateFrom || dateTo ? { gte: dateFrom ? new Date(dateFrom) : undefined, lte: dateTo ? new Date(dateTo) : undefined } : undefined
      },
      orderBy: { date: "desc" },
      include: { worker: { select: { id: true, name: true, workerType: true } } }
    });
  }

  recordAttendance(data: Prisma.AttendanceLogUncheckedCreateInput) {
    return this.prisma.attendanceLog.create({ data });
  }

  updateAttendance(id: string, data: Prisma.AttendanceLogUncheckedUpdateInput) {
    return this.prisma.attendanceLog.update({ where: { id }, data });
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
  async list(@Query("tenantId") tenantId?: string, @Query("status") status?: string) {
    const data = await this.service.list(tenantId, status);
    return { data, message: "Workers fetched" };
  }

  @Get("attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async tenantAttendance(
    @Query("tenantId") tenantId: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    const data = await this.service.listAttendanceByTenant(tenantId, from, to);
    return { data, message: "Attendance logs fetched" };
  }

  @Post("attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async recordAttendance(@Body() body: Prisma.AttendanceLogUncheckedCreateInput) {
    const data = await this.service.recordAttendance(body);
    return { data, message: "Attendance recorded" };
  }

  @Patch("attendance/:id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async updateAttendance(@Param("id") id: string, @Body() body: Prisma.AttendanceLogUncheckedUpdateInput) {
    const data = await this.service.updateAttendance(id, body);
    return { data, message: "Attendance updated" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Worker fetched" };
  }

  @Get(":id/attendance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "VIEWER")
  async listAttendance(@Param("id") id: string) {
    const data = await this.service.listAttendance(id);
    return { data, message: "Worker attendance fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(@Body() body: Prisma.FarmWorkerUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Worker created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async update(@Param("id") id: string, @Body() body: Prisma.FarmWorkerUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Worker updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Worker removed" };
  }
}

@Module({
  controllers: [FarmWorkersController],
  providers: [FarmWorkersService],
  exports: [FarmWorkersService]
})
export class FarmWorkersModule {}
