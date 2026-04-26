import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class SprayLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, fieldId?: string, complianceFlag?: string) {
    return this.prisma.sprayLog.findMany({
      where: {
        tenantId: tenantId ?? undefined,
        fieldId: fieldId ?? undefined,
        complianceFlag: complianceFlag === undefined ? undefined : complianceFlag === "true"
      },
      orderBy: { date: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string) {
    return this.prisma.sprayLog.findUnique({ where: { id }, include: { field: true, cropCycle: true } });
  }

  create(data: Prisma.SprayLogUncheckedCreateInput) {
    return this.prisma.sprayLog.create({ data });
  }

  update(id: string, data: Prisma.SprayLogUncheckedUpdateInput) {
    return this.prisma.sprayLog.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.sprayLog.delete({ where: { id } });
  }

  pendingCompliance(tenantId?: string) {
    return this.prisma.sprayLog.findMany({
      where: { tenantId: tenantId ?? undefined, complianceFlag: true },
      orderBy: { date: "desc" }
    });
  }
}

@ApiTags("Farm / Spray Logs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/spray-logs")
export class SprayLogsController {
  constructor(private readonly service: SprayLogsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async list(
    @Query("tenantId") tenantId?: string,
    @Query("fieldId") fieldId?: string,
    @Query("compliance") compliance?: string
  ) {
    const data = await this.service.list(tenantId, fieldId, compliance);
    return { data, message: "Spray logs fetched" };
  }

  @Get("compliance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async pending(@Query("tenantId") tenantId?: string) {
    const data = await this.service.pendingCompliance(tenantId);
    return { data, message: "Compliance flagged spray logs fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Spray log fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST")
  async create(@Body() body: Prisma.SprayLogUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Spray log created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Param("id") id: string, @Body() body: Prisma.SprayLogUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Spray log updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Spray log removed" };
  }
}

@Module({
  controllers: [SprayLogsController],
  providers: [SprayLogsService],
  exports: [SprayLogsService]
})
export class SprayLogsModule {}
