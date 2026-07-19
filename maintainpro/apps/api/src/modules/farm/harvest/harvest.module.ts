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
export class HarvestService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, cropCycleId?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.harvestRecord.findMany({
      where: { tenantId: scopedTenantId, cropCycleId: cropCycleId ?? undefined },
      orderBy: { harvestDate: "desc" },
      include: { cropCycle: { select: { id: true, cropType: true, fieldId: true } } }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.harvestRecord.findFirst({ where: { id, tenantId: scopedTenantId }, include: { cropCycle: true } });
  }

  async create(tenantId: string | null, data: Prisma.HarvestRecordUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    if (!data.cropCycleId) {
      throw new BadRequestException("cropCycleId is required");
    }
    // Cross-tenant FK validation: the crop cycle must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.cropCycle, data.cropCycleId, {
      tenantId: scopedTenantId,
      entityName: "Crop cycle"
    });
    return this.prisma.harvestRecord.create({ data: { ...data, tenantId: scopedTenantId } });
  }

  async update(id: string, tenantId: string | null, data: Prisma.HarvestRecordUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.harvestRecord, id, { tenantId: scopedTenantId, entityName: "Harvest record" });
    if (typeof data.cropCycleId === "string" && data.cropCycleId) {
      await assertTenantEntityExists(this.prisma.cropCycle, data.cropCycleId, {
        tenantId: scopedTenantId,
        entityName: "Crop cycle"
      });
    }
    const { tenantId: _ignored, id: _id, ...safe } = data as Record<string, unknown>;
    return this.prisma.harvestRecord.update({ where: { id }, data: safe as Prisma.HarvestRecordUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.harvestRecord, id, { tenantId: scopedTenantId, entityName: "Harvest record" });
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
  async list(@Req() req: AuthedRequest, @Query("cropCycleId") cropCycleId?: string) {
    const data = await this.service.list(req.user?.tenantId ?? null, cropCycleId);
    return { data, message: "Harvest records fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER", "HARVEST_CREW")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Harvest record fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "HARVEST_CREW")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.HarvestRecordUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Harvest record created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.HarvestRecordUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Harvest record updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Harvest record removed" };
  }
}

@Module({
  controllers: [HarvestController],
  providers: [HarvestService],
  exports: [HarvestService]
})
export class HarvestModule {}
