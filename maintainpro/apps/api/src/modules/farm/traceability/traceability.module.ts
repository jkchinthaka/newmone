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
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";

import { Public } from "../../../common/decorators/public.decorator";
import { Roles } from "../../../common/decorators/roles.decorator";
import { SkipTenantContext } from "../../../common/decorators/skip-tenant-context.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { PrismaService } from "../../../database/prisma.service";

@Injectable()
export class TraceabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  list(tenantId?: string) {
    return this.prisma.traceabilityRecord.findMany({
      where: { tenantId: tenantId ?? undefined },
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

  async create(input: {
    tenantId: string;
    cropCycleId: string;
    fieldId: string;
    harvestRecordId?: string;
    sprayLogIds?: string[];
    soilTestId?: string;
    harvestDate: string | Date;
    buyerName?: string;
    certifications?: string[];
  }) {
    const batchCode = await this.generateBatchCode(input.tenantId);
    const baseUrl = this.config.get<string>("TRACEABILITY_PUBLIC_BASE_URL", "https://trace.nelnafarm.lk");
    const publicUrl = `${baseUrl.replace(/\/+$/, "")}/${batchCode}`;
    return this.prisma.traceabilityRecord.create({
      data: {
        tenantId: input.tenantId,
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

  async public(batchCode: string) {
    const record = await this.prisma.traceabilityRecord.findFirst({ where: { batchCode } });
    if (!record) throw new NotFoundException("Batch not found");

    const [field, cropCycle, harvest, soilTest, sprayLogs] = await Promise.all([
      this.prisma.field.findUnique({ where: { id: record.fieldId }, select: { name: true, areaHectares: true, soilType: true } }),
      this.prisma.cropCycle.findUnique({
        where: { id: record.cropCycleId },
        select: { cropType: true, variety: true, plantingDate: true, actualHarvestDate: true }
      }),
      record.harvestRecordId
        ? this.prisma.harvestRecord.findUnique({
            where: { id: record.harvestRecordId },
            select: { quantityKg: true, qualityGrade: true, moistureLevel: true, harvestDate: true }
          })
        : Promise.resolve(null),
      record.soilTestId
        ? this.prisma.soilTest.findUnique({
            where: { id: record.soilTestId },
            select: { ph: true, organicMatterPct: true, recommendation: true }
          })
        : Promise.resolve(null),
      record.sprayLogIds.length
        ? this.prisma.sprayLog.findMany({
            where: { id: { in: record.sprayLogIds } },
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
  async list(@Query("tenantId") tenantId?: string) {
    const data = await this.service.list(tenantId);
    return { data, message: "Traceability records fetched" };
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Roles("SUPER_ADMIN", "ADMIN", "FARM_OWNER", "FARM_MANAGER")
  async create(@Body() body: Parameters<TraceabilityService["create"]>[0]) {
    if (!body?.tenantId || !body?.cropCycleId || !body?.fieldId || !body?.harvestDate) {
      throw new BadRequestException("tenantId, cropCycleId, fieldId, harvestDate are required");
    }
    const data = await this.service.create(body);
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
