import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Prisma } from "@prisma/client";

import { Roles } from "../../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

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

  list(tenantId?: string, fieldId?: string, status?: string) {
    return this.prisma.cropCycle.findMany({
      where: { tenantId: tenantId ?? undefined, fieldId: fieldId ?? undefined, status: status as never },
      orderBy: { plantingDate: "desc" },
      include: { field: { select: { id: true, name: true } } }
    });
  }

  get(id: string) {
    return this.prisma.cropCycle.findUnique({
      where: { id },
      include: { field: true, harvestRecords: true, sprayLogs: true }
    });
  }

  create(data: Prisma.CropCycleUncheckedCreateInput) {
    const normalized = normalizeCropPayload(data as Record<string, unknown>, true);
    return this.prisma.cropCycle.create({ data: normalized as Prisma.CropCycleUncheckedCreateInput });
  }

  update(id: string, data: Prisma.CropCycleUncheckedUpdateInput) {
    const normalized = normalizeCropPayload(data as Record<string, unknown>, false);
    return this.prisma.cropCycle.update({ where: { id }, data: normalized as Prisma.CropCycleUncheckedUpdateInput });
  }

  remove(id: string) {
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
    @Query("tenantId") tenantId?: string,
    @Query("fieldId") fieldId?: string,
    @Query("status") status?: string
  ) {
    const data = await this.service.list(tenantId, fieldId, status);
    return { data, message: "Crop cycles fetched" };
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "FIELD_SUPERVISOR", "AGRONOMIST", "VIEWER")
  async get(@Param("id") id: string) {
    const data = await this.service.get(id);
    return { data, message: "Crop cycle fetched" };
  }

  @Post()
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async create(@Body() body: Prisma.CropCycleUncheckedCreateInput) {
    const data = await this.service.create(body);
    return { data, message: "Crop cycle created" };
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "AGRONOMIST")
  async update(@Param("id") id: string, @Body() body: Prisma.CropCycleUncheckedUpdateInput) {
    const data = await this.service.update(id, body);
    return { data, message: "Crop cycle updated" };
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER")
  async remove(@Param("id") id: string) {
    const data = await this.service.remove(id);
    return { data, message: "Crop cycle removed" };
  }
}

@Module({
  controllers: [CropsController],
  providers: [CropsService],
  exports: [CropsService]
})
export class CropsModule {}
