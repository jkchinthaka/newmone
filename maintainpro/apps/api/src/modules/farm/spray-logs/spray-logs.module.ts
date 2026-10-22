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
export class SprayLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, fieldId?: string, complianceFlag?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.sprayLog.findMany({
      where: {
        tenantId: scopedTenantId,
        fieldId: fieldId ?? undefined,
        complianceFlag: complianceFlag === undefined ? undefined : complianceFlag === "true"
      },
      orderBy: { date: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.sprayLog.findFirst({ where: { id, tenantId: scopedTenantId }, include: { field: true, cropCycle: true } });
  }

  async create(tenantId: string | null, data: Prisma.SprayLogUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!data.fieldId) {
      throw new BadRequestException("fieldId is required");
    }
    // Cross-tenant FK validation: field (required) and crop cycle (optional) must be tenant-owned.
    await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    if (typeof data.cropCycleId === "string" && data.cropCycleId) {
      await assertTenantEntityExists(this.prisma.cropCycle, data.cropCycleId, {
        tenantId: scopedTenantId,
        entityName: "Crop cycle"
      });
    }
    return this.prisma.sprayLog.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.SprayLogUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.sprayLog, id, { tenantId: scopedTenantId, entityName: "Spray log" });
    if (typeof data.fieldId === "string" && data.fieldId) {
      await assertTenantEntityExists(this.prisma.field, data.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    }
    if (typeof data.cropCycleId === "string" && data.cropCycleId) {
      await assertTenantEntityExists(this.prisma.cropCycle, data.cropCycleId, {
        tenantId: scopedTenantId,
        entityName: "Crop cycle"
      });
    }
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.sprayLog.update({ where: { id }, data: safe as Prisma.SprayLogUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.sprayLog, id, { tenantId: scopedTenantId, entityName: "Spray log" });
    return this.prisma.sprayLog.delete({ where: { id } });
  }

  pendingCompliance(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.sprayLog.findMany({
      where: { tenantId: scopedTenantId, complianceFlag: true },
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
    @Req() req: AuthedRequest,
    @Query("fieldId") fieldId?: string,
    @Query("compliance") compliance?: string
  ) {
    const data = await this.service.list(req.user?.tenantId ?? null, fieldId, compliance);
    return { data, message: "Spray logs fetched" };
  }

  @Get("compliance")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async pending(@Req() req: AuthedRequest) {
    const data = await this.service.pendingCompliance(req.user?.tenantId ?? null);
    return { data, message: "Compliance flagged spray logs fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Spray log fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.SprayLogUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Spray log created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.SprayLogUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Spray log updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Spray log removed" };
  }
}

@Module({
  controllers: [SprayLogsController],
  providers: [SprayLogsService],
  exports: [SprayLogsService]
})
export class SprayLogsModule {}
