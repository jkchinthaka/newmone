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
export class IrrigationService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, fieldId?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.irrigationLog.findMany({
      where: { tenantId: scopedTenantId, fieldId: fieldId ?? undefined },
      orderBy: { startTime: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.irrigationLog.findFirst({ where: { id, tenantId: scopedTenantId }, include: { field: true } });
  }

  async create(tenantId: string | null, data: Prisma.IrrigationLogUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!data.fieldId) {
      throw new BadRequestException("fieldId is required");
    }
    // Cross-tenant FK validation: the field must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    if (data.startTime && data.endTime && !data.durationMinutes) {
      const start = new Date(data.startTime as Date | string);
      const end = new Date(data.endTime as Date | string);
      data.durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    return this.prisma.irrigationLog.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.IrrigationLogUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.irrigationLog, id, { tenantId: scopedTenantId, entityName: "Irrigation log" });
    if (typeof data.fieldId === "string" && data.fieldId) {
      await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    }
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.irrigationLog.update({ where: { id }, data: safe as Prisma.IrrigationLogUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.irrigationLog, id, { tenantId: scopedTenantId, entityName: "Irrigation log" });
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
  async list(@Req() req: AuthedRequest, @Query("fieldId") fieldId?: string) {
    const data = await this.service.list(req.user?.tenantId ?? null, fieldId);
    return { data, message: "Irrigation logs fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "IRRIGATION_OPERATOR", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Irrigation log fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "IRRIGATION_OPERATOR")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.IrrigationLogUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Irrigation log created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "IRRIGATION_OPERATOR")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.IrrigationLogUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Irrigation log updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Irrigation log removed" };
  }
}

@Module({
  controllers: [IrrigationController],
  providers: [IrrigationService],
  exports: [IrrigationService]
})
export class IrrigationModule {}
