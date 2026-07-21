import { Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
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
export class FieldsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, status?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.field.findMany({
      where: { tenantId: scopedTenantId, status: status as never },
      orderBy: { createdAt: "desc" }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.field.findFirst({ where: { id, tenantId: scopedTenantId } });
  }

  create(tenantId: string | null, data: Prisma.FieldUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.field.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.FieldUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.field, id, { tenantId: scopedTenantId, entityName: "Field" });
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.field.update({ where: { id }, data: safe as Prisma.FieldUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.field, id, { tenantId: scopedTenantId, entityName: "Field" });
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
  async list(@Req() req: AuthedRequest, @Query("status") status?: string) {
    const data = await this.service.list(req.user?.tenantId ?? null, status);
    return { data, message: "Fields fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Field fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.FieldUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Field created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.FieldUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Field updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Field removed" };
  }
}

@Module({
  controllers: [FieldsController],
  providers: [FieldsService],
  exports: [FieldsService]
})
export class FieldsModule {}
