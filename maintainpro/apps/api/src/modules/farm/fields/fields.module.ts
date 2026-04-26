import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class FieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId?: string, status?: string) {
    return this.prisma.field.findMany({
      where: { tenantId: tenantId ?? undefined, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  get(id: string) {
    return this.prisma.field.findUnique({ where: { id } });
  }

  create(data: Prisma.FieldUncheckedCreateInput) {
    return this.prisma.field.create({ data });
  }

  update(id: string, data: Prisma.FieldUncheckedUpdateInput) {
    return this.prisma.field.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.field.delete({ where: { id } });
  }
}

@ApiTags("Farm / Fields")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/fields")
export class FieldsController {
  constructor(private readonly service: FieldsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async list(@Query("tenantId") tenantId?: string, @Query("status") status?: string) {
    const data = await this.service.list(tenantId, status);
    return { data, message: "Fields fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Field fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(@Body() body: Prisma.FieldUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Field created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async update(@Param("id") id: string, @Body() body: Prisma.FieldUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Field updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Field removed" };
  }
}

@Module({
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [FieldsService]
})
export class FieldsModule {}
