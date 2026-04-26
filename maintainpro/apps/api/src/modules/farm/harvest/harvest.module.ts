import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class HarvestService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, cropCycleId?: string) {
    return this.prisma.harvestRecord.findMany({
      where: { tenantId: tenantId ?? undefined, cropCycleId: cropCycleId ?? undefined },
      orderBy: { harvestDate: "desc" },
      include: { cropCycle: { select: { id: true, cropType: true, fieldId: true } } }
    });
  }

  get(id: string) {
    return this.prisma.harvestRecord.findUnique({ where: { id }, include: { cropCycle: true } });
  }

  create(data: Prisma.HarvestRecordUncheckedCreateInput) {
    return this.prisma.harvestRecord.create({ data });
  }

  update(id: string, data: Prisma.HarvestRecordUncheckedUpdateInput) {
    return this.prisma.harvestRecord.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.harvestRecord.delete({ where: { id } });
  }
}

@ApiTags("Farm / Harvest")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/harvest")
export class HarvestController {
  constructor(private readonly service: HarvestService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER", "HARVEST_CREW")
  async list(@Query("tenantId") tenantId?: string, @Query("cropCycleId") cropCycleId?: string) {
    const data = await this.service.list(tenantId, cropCycleId);
    return { data, message: "Harvest records fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER", "HARVEST_CREW")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Harvest record fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "HARVEST_CREW")
  async create(@Body() body: Prisma.HarvestRecordUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Harvest record created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async update(@Param("id") id: string, @Body() body: Prisma.HarvestRecordUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Harvest record updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Harvest record removed" };
  }
}

@Module({
  controllers: [HarvestController],
  providers: [HarvestService],
  exports: [HarvestService]
})
export class HarvestModule {}
