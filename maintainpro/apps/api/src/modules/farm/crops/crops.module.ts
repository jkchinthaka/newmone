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

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const DATE_FIELDS = ["plantingDate", "expectedHarvestDate", "actualHarvestDate", "archivedAt"] as const;
const OBJECT_ID_FIELDS = ["tenantId", "fieldId"] as const;

function normalizeCropPayload<T extends Record<string, unknown>>(data: T, requireIds: boolean): T {
  const out: Record<string, unknown> = { ...data };
  for (const key of OBJECT_ID_FIELDS) {
    const v = out[key];
    if (v === undefined || v === null || v === "") {
      if (requireIds) throw new BadRequestException(`${key} is required`);
      continue;
    }
    if (typeof v !== "string" || !OBJECT_ID_RE.test(v)) {
      throw new BadRequestException(`${key} must be a 24-character hex ObjectId`);
    }
  }
  for (const key of DATE_FIELDS) {
    const v = out[key];
    if (v === undefined || v === null || v === "") continue;
    if (v instanceof Date) continue;
    const d = new Date(v as string);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${key} must be a valid ISO-8601 date`);
    }
    out[key] = d;
  }
  if (requireIds && (out.cropType === undefined || out.cropType === "")) {
    throw new BadRequestException("cropType is required");
  }
  if (requireIds && !out.plantingDate) {
    throw new BadRequestException("plantingDate is required");
  }
  return out as T;
}

@Injectable()
export class CropsService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string | null, fieldId?: string, status?: string) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.cropCycle.findMany({
      where: { tenantId: scopedTenantId, fieldId: fieldId ?? undefined, status: status as never },
      orderBy: { plantingDate: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.cropCycle.findFirst({
      where: { id, tenantId: scopedTenantId },
      include: { field: true, harvestRecords: true, sprayLogs: true }
    });
  }

  async create(tenantId: string | null, data: Prisma.CropCycleUncheckedCreateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    const normalized = normalizeCropPayload(
      { ...(data as Record<string, unknown>), tenantId: scopedTenantId },
      true
    ) as Record<string, unknown>;
    // Cross-tenant FK validation: the field must belong to the active tenant.
    await assertTenantEntityExists(this.prisma.field, normalized.fieldId as string, {
      tenantId: scopedTenantId,
      entityName: "Field"
    });
    return this.prisma.cropCycle.create({ data: normalized as unknown as Prisma.CropCycleUncheckedCreateInput });
  }

  async update(id: string, tenantId: string | null, data: Prisma.CropCycleUncheckedUpdateInput) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.cropCycle, id, { tenantId: scopedTenantId, entityName: "Crop cycle" });
    const normalized = normalizeCropPayload(data as Record<string, unknown>, false);
    // If the field is being reassigned it must also belong to the active tenant.
    if (typeof normalized.fieldId === "string" && normalized.fieldId) {
      await assertTenantEntityExists(this.prisma.field, normalized.fieldId, {
        tenantId: scopedTenantId,
        entityName: "Field"
      });
    }
    const { tenantId: _ignored, id: _id, ...safe } = normalized as Record<string, unknown>;
    return this.prisma.cropCycle.update({ where: { id }, data: safe as Prisma.CropCycleUncheckedUpdateInput });
  }

  async remove(id: string, tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    await assertTenantEntityExists(this.prisma.cropCycle, id, { tenantId: scopedTenantId, entityName: "Crop cycle" });
    return this.prisma.cropCycle.delete({ where: { id } });
  }
}

@ApiTags("Farm / Crops")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("farm/crops")
export class CropsController {
  constructor(private readonly service: CropsService) {}

  @Get()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async list(
    @Req() req: AuthedRequest,
    @Query("fieldId") fieldId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.service.list(req.user?.tenantId ?? null, fieldId, status);
    return { data, message: "Crop cycles fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.get(id, req.user?.tenantId ?? null);
    return { data, message: "Crop cycle fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async create(@Req() req: AuthedRequest, @Body() body: Prisma.CropCycleUncheckedCreateInput) {
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Crop cycle created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Req() req: AuthedRequest, @Param("id") id: string, @Body() body: Prisma.CropCycleUncheckedUpdateInput) {
    const data = await this.service.update(id, req.user?.tenantId ?? null, body);
    return { data, message: "Crop cycle updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Req() req: AuthedRequest, @Param("id") id: string) {
    const data = await this.service.remove(id, req.user?.tenantId ?? null);
    return { data, message: "Crop cycle removed" };
  }
}

@Module({
  controllers: [CropsController],
  providers: [CropsService],
  exports: [CropsService]
})
export class CropsModule {}
