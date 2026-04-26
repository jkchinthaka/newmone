import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class IrrigationService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, fieldId?: string) {
    return this.prisma.irrigationLog.findMany({
      where: { tenantId: tenantId ?? undefined, fieldId: fieldId ?? undefined },
      orderBy: { startTime: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string) {
    return this.prisma.irrigationLog.findUnique({ where: { id }, include: { field: true } });
  }

  create(data: Prisma.IrrigationLogUncheckedCreateInput) {
    if (data.startTime && data.endTime && !data.durationMinutes) {
      const start = new Date(data.startTime as Date | string);
      const end = new Date(data.endTime as Date | string);
      data.durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    return this.prisma.irrigationLog.create({ data });
  }

  update(id: string, data: Prisma.IrrigationLogUncheckedUpdateInput) {
    return this.prisma.irrigationLog.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.irrigationLog.delete({ where: { id } });
  }
}

@ApiTags("Farm / Irrigation")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/irrigation")
export class IrrigationController {
  constructor(private readonly service: IrrigationService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "IRRIGATION_OPERATOR", "VIEWER")
  async list(@Query("tenantId") tenantId?: string, @Query("fieldId") fieldId?: string) {
    const data = await this.service.list(tenantId, fieldId);
    return { data, message: "Irrigation logs fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "IRRIGATION_OPERATOR", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Irrigation log fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "IRRIGATION_OPERATOR")
  async create(@Body() body: Prisma.IrrigationLogUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Irrigation log created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "IRRIGATION_OPERATOR")
  async update(@Param("id") id: string, @Body() body: Prisma.IrrigationLogUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Irrigation log updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Irrigation log removed" };
  }
}

@Module({
  controllers: [IrrigationController],
  providers: [IrrigationService],
  exports: [IrrigationService]
})
export class IrrigationModule {}
