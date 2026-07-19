import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SkipTenantContext } from "../../../common/decorators/skip-tenant-context.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import {
  assertTenantEntitiesExist,
  assertTenantEntityExists,
  requireTenantId
} from "../../../common/utils/tenant-scope.util";
import { PrismaService } from "../../../database/prisma.service";

interface AuthedRequest {
  user?: { sub: string; role: string; tenantId?: string | null };
}

@Injectable()
export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  list(tenantId: string | null) {
    const scopedTenantId = requireTenantId(tenantId);
    return this.prisma.traceabilityRecord.findMany({
      where: { tenantId: scopedTenantId },
      orderBy: { createdAt: "desc" }
    });
  }

  async generateBatchCode(tenantId: string) {
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = `NF-${yyyymmdd}-`;
    const todayCount = await this.prisma.traceabilityRecord.count({
      where: { tenantId, batchCode: { startsWith: prefix } }
    });
    return `${prefix}${String(todayCount + 1).padStart(3, "0")}`;
  }

  async create(
    tenantId: string | null,
    input: {
      cropCycleId: string;
      fieldId: string;
      harvestRecordId?: string;
      sprayLogIds?: string[];
      soilTestId?: string;
      harvestDate: string | Date;
      buyerName?: string;
      certifications?: string[];
    }
  ) {
    const scopedTenantId = requireTenantId(tenantId);

    // Cross-tenant FK validation: every node linked into the traceability graph
    // must belong to the active tenant, so a batch can never traverse tenants.
    await assertTenantEntityExists(this.prisma.field, input.fieldId, { tenantId: scopedTenantId, entityName: "Field" });
    await assertTenantEntityExists(this.prisma.cropCycle, input.cropCycleId, {
      tenantId: scopedTenantId,
      entityName: "Crop cycle"
    });
    if (input.harvestRecordId) {
      await assertTenantEntityExists(this.prisma.harvestRecord, input.harvestRecordId, {
        tenantId: scopedTenantId,
        entityName: "Harvest record"
      });
    }
    if (input.soilTestId) {
      await assertTenantEntityExists(this.prisma.soilTest, input.soilTestId, {
        tenantId: scopedTenantId,
        entityName: "Soil test"
      });
    }
    if (input.sprayLogIds && input.sprayLogIds.length > 0) {
      await assertTenantEntitiesExist(this.prisma.sprayLog, input.sprayLogIds, {
        tenantId: scopedTenantId,
        entityName: "Spray log"
      });
    }

    const batchCode = await this.generateBatchCode(scopedTenantId);
    const baseUrl = this.config.get<string>("TRACEABILITY_PUBLIC_BASE_URL", "https://trace.nelnafarm.lk");
    const publicUrl = `${baseUrl.replace(/\/+$/, "")}/${batchCode}`;
    return this.prisma.traceabilityRecord.create({
      data: {
        tenantId: scopedTenantId,
        batchCode,
        cropCycleId: input.cropCycleId,
        fieldId: input.fieldId,
        harvestRecordId: input.harvestRecordId,
        sprayLogIds: input.sprayLogIds ?? [],
        soilTestId: input.soilTestId,
        harvestDate: new Date(input.harvestDate),
        buyerName: input.buyerName,
        certifications: input.certifications ?? [],
        publicUrl
      }
    });
  }

  /**
   * Public consumer-facing batch lookup. Intentionally unauthenticated and
   * tenant-agnostic: a batch code is an opaque, non-enumerable QR identifier and
   * only denormalized, publish-safe fields are returned. All linked records are
   * fetched within the record's own tenant (the batch record's tenantId), so the
   * public projection can never traverse into another tenant's data.
   */
  async public(batchCode: string) {
    const record = await this.prisma.traceabilityRecord.findFirst({ where: { batchCode } });
    if (!record) throw new NotFoundException("Batch not found");

    const recordTenantId = record.tenantId;
    const [field, cropCycle, harvest, soilTest, sprayLogs] = await Promise.all([
      this.prisma.field.findFirst({
        where: { id: record.fieldId, tenantId: recordTenantId },
        select: { name: true, areaHectares: true, soilType: true }
      }),
      this.prisma.cropCycle.findFirst({
        where: { id: record.cropCycleId, tenantId: recordTenantId },
        select: { cropType: true, variety: true, plantingDate: true, actualHarvestDate: true }
      }),
      record.harvestRecordId
        ? this.prisma.harvestRecord.findFirst({
            where: { id: record.harvestRecordId, tenantId: recordTenantId },
            select: { quantityKg: true, qualityGrade: true, moistureLevel: true, harvestDate: true }
          })
        : Promise.resolve(null),
      record.soilTestId
        ? this.prisma.soilTest.findFirst({
            where: { id: record.soilTestId, tenantId: recordTenantId },
            select: { ph: true, organicMatterPct: true, recommendation: true }
          })
        : Promise.resolve(null),
      record.sprayLogIds.length
        ? this.prisma.sprayLog.findMany({
            where: { id: { in: record.sprayLogIds }, tenantId: recordTenantId },
            select: { date: true, chemicalName: true, chemicalType: true, priorHarvestDays: true, complianceFlag: true }
          })
        : Promise.resolve([])
    ]);

    return {
      batchCode: record.batchCode,
      harvestDate: record.harvestDate,
      buyerName: record.buyerName,
      certifications: record.certifications,
      field,
      cropCycle,
      harvest,
      soilTest,
      sprayLogs
    };
  }
}

@ApiTags("Farm / Traceability")
@Controller("farm/traceability")
export class TraceabilityController {
  constructor(private readonly service: TraceabilityService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER", "VIEWER")
  async list(@Req() req: AuthedRequest) {
    const data = await this.service.list(req.user?.tenantId ?? null);
    return { data, message: "Traceability records fetched" };
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(
    @Req() req: AuthedRequest,
    @Body() body: Parameters<TraceabilityService["create"]>[1] & { tenantId?: string }
  ) {
    if (!body?.cropCycleId || !body?.fieldId || !body?.harvestDate) {
      throw new BadRequestException("cropCycleId, fieldId, harvestDate are required");
    }
    const data = await this.service.create(req.user?.tenantId ?? null, body);
    return { data, message: "Traceability record created" };
  }

  @Get("public/:batchCode")
  @Public()
  @SkipTenantContext()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async publicLookup(@Param("batchCode") batchCode: string) {
    const data = await this.service.public(batchCode);
    return { data, message: "Traceability info fetched" };
  }
}

@Module({
  controllers: [TraceabilityController],
  providers: [TraceabilityService],
  exports: [TraceabilityService]
})
export class TraceabilityModule {}
