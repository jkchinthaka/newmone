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
export class SoilTestsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, fieldId?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.soilTest.findMany({
      where: { tenantId: scopedTenantId, fieldId: fieldId ?? undefined },
      orderBy: { testDate: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.soilTest.findFirst({ where: { id, tenantId: scopedTenantId }, include: { field: true } });
  }

  async create(tenantId: string | null, data: Prisma.SoilTestUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!data.fieldId) {
      throw new BadRequestException("fieldId is required");
    }
    // Cross-tenant FK validation: the field must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    return this.prisma.soilTest.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.SoilTestUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.soilTest, id, { tenantId: scopedTenantId, entityName: "Soil test" });
    if (typeof data.fieldId === "string" && data.fieldId) {
      await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    }
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.soilTest.update({ where: { id }, data: safe as Prisma.SoilTestUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.soilTest, id, { tenantId: scopedTenantId, entityName: "Soil test" });
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
  async list(@Req() req: AuthedRequest, @Query("fieldId") fieldId?: string) {
    const data = await this.service.list(req.user?.tenantId ?? null, fieldId);
    return { data, message: "Soil tests fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Soil test fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.SoilTestUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Soil test created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.SoilTestUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Soil test updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Soil test removed" };
  }
}

@Module({
  controllers: [SoilTestsController],
  providers: [SoilTestsService],
  exports: [SoilTestsService]
})
export class SoilTestsModule {}
