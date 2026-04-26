import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class SoilTestsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, fieldId?: string) {
    return this.prisma.soilTest.findMany({
      where: { tenantId: tenantId ?? undefined, fieldId: fieldId ?? undefined },
      orderBy: { testDate: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string) {
    return this.prisma.soilTest.findUnique({ where: { id }, include: { field: true } });
  }

  create(data: Prisma.SoilTestUncheckedCreateInput) {
    return this.prisma.soilTest.create({ data });
  }

  update(id: string, data: Prisma.SoilTestUncheckedUpdateInput) {
    return this.prisma.soilTest.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.soilTest.delete({ where: { id } });
  }
}

@ApiTags("Farm / Soil Tests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/soil-tests")
export class SoilTestsController {
  constructor(private readonly service: SoilTestsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST", "VIEWER")
  async list(@Query("tenantId") tenantId?: string, @Query("fieldId") fieldId?: string) {
    const data = await this.service.list(tenantId, fieldId);
    return { data, message: "Soil tests fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Soil test fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async create(@Body() body: Prisma.SoilTestUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Soil test created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Param("id") id: string, @Body() body: Prisma.SoilTestUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Soil test updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Soil test removed" };
  }
}

@Module({
  controllers: [SoilTestsController],
  providers: [SoilTestsService],
  exports: [SoilTestsService]
})
export class SoilTestsModule {}
