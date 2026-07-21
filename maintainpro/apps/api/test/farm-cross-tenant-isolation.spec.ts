import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { requestContext } from "../src/common/context/request-context";
import { CropsService } from "../src/modules/farm/crops/crops.module";
import { FarmFinanceService } from "../src/modules/farm/farm-finance/farm-finance.module";
import { FarmWorkersService } from "../src/modules/farm/farm-workers/farm-workers.module";
import { FieldsService } from "../src/modules/farm/fields/fields.module";
import { HarvestService } from "../src/modules/farm/harvest/harvest.module";
import { IrrigationService } from "../src/modules/farm/irrigation/irrigation.module";
import { LivestockService } from "../src/modules/farm/livestock/livestock.module";
import { SoilTestsService } from "../src/modules/farm/soil-tests/soil-tests.module";
import { SprayLogsService } from "../src/modules/farm/spray-logs/spray-logs.module";
import { TraceabilityService } from "../src/modules/farm/traceability/traceability.module";
import { WeatherService } from "../src/modules/farm/weather/weather.module";
import { FarmCacheService } from "../src/modules/farm/farm-cache.service";

const TENANT_A = "5071f177bc8f6cd799439a01";
const TENANT_B = "5071f177bc8f6cd799439b02";
const FIELD_A = "5071f177bc8f6cd799439f01";
const FIELD_B = "5071f177bc8f6cd799439f02";

function delegate(): Record<string, jest.Mock> {
  return {
    findMany: jest.fn().mockResolvedValue([]) as jest.Mock,
    findFirst: jest.fn().mockResolvedValue(null) as jest.Mock,
    findUnique: jest.fn().mockResolvedValue(null) as jest.Mock,
    create: jest.fn().mockResolvedValue({ id: "new" }) as jest.Mock,
    update: jest.fn().mockResolvedValue({ id: "upd" }) as jest.Mock,
    delete: jest.fn().mockResolvedValue({ id: "del" }) as jest.Mock,
    count: jest.fn().mockResolvedValue(0) as jest.Mock
  };
}

function buildPrisma() {
  return {
    field: delegate(),
    cropCycle: delegate(),
    harvestRecord: delegate(),
    irrigationLog: delegate(),
    soilTest: delegate(),
    sprayLog: delegate(),
    farmWorker: delegate(),
    attendanceLog: delegate(),
    livestockAnimal: delegate(),
    animalHealthRecord: delegate(),
    animalProductionLog: delegate(),
    feedingLog: delegate(),
    farmExpense: delegate(),
    farmIncome: delegate(),
    traceabilityRecord: delegate(),
    weatherLog: delegate(),
    tenant: delegate()
  };
}

const config = { get: jest.fn((_k: string, d?: unknown) => d) } as never;

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------
describe("Farm fields cross-tenant isolation", () => {
  it("scopes list to the active tenant (no cross-tenant leakage)", async () => {
    const prisma = buildPrisma();
    const service = new FieldsService(prisma as never);
    await service.list(TENANT_A);
    expect(prisma.field.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });

  it("tenant-less caller is denied (403) on list", () => {
    const prisma = buildPrisma();
    const service = new FieldsService(prisma as never);
    expect(() => service.list(null)).toThrow(ForbiddenException);
  });

  it("cannot fetch another tenant's field by id", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null);
    const service = new FieldsService(prisma as never);
    await expect(service.get(FIELD_B, TENANT_A)).resolves.toBeNull();
    expect(prisma.field.findFirst).toHaveBeenCalledWith({ where: { id: FIELD_B, tenantId: TENANT_A } });
  });

  it("cannot update another tenant's field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null); // not owned by TENANT_A
    const service = new FieldsService(prisma as never);
    await expect(service.update(FIELD_B, TENANT_A, { name: "x" })).rejects.toThrow(NotFoundException);
    expect(prisma.field.update).not.toHaveBeenCalled();
  });

  it("cannot delete another tenant's field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null);
    const service = new FieldsService(prisma as never);
    await expect(service.remove(FIELD_B, TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prisma.field.delete).not.toHaveBeenCalled();
  });

  it("forces the active tenant on create (ignores client tenantId)", async () => {
    const prisma = buildPrisma();
    const service = new FieldsService(prisma as never);
    await service.create(TENANT_A, { tenantId: TENANT_B, name: "F", areaHectares: 1 } as never);
    expect(prisma.field.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT_A, name: "F" })
    });
  });
});

// ---------------------------------------------------------------------------
// Crops (field FK)
// ---------------------------------------------------------------------------
describe("Farm crops cross-tenant isolation", () => {
  it("rejects linking a crop to another tenant's field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null); // field not in TENANT_A
    const service = new CropsService(prisma as never);
    await expect(
      service.create(TENANT_A, {
        tenantId: TENANT_B,
        fieldId: FIELD_B,
        cropType: "Rice",
        plantingDate: "2026-01-01"
      } as never)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.cropCycle.create).not.toHaveBeenCalled();
  });

  it("creates a crop when the field belongs to the active tenant", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue({ id: FIELD_A });
    const service = new CropsService(prisma as never);
    await service.create(TENANT_A, {
      fieldId: FIELD_A,
      cropType: "Rice",
      plantingDate: "2026-01-01"
    } as never);
    expect(prisma.cropCycle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT_A, fieldId: FIELD_A })
    });
  });

  it("cannot fetch another tenant's crop by id", async () => {
    const prisma = buildPrisma();
    prisma.cropCycle.findFirst.mockResolvedValue(null);
    const service = new CropsService(prisma as never);
    await service.get("crop-b", TENANT_A);
    expect(prisma.cropCycle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "crop-b", tenantId: TENANT_A } })
    );
  });
});

// ---------------------------------------------------------------------------
// Harvest (crop cycle FK)
// ---------------------------------------------------------------------------
describe("Farm harvest cross-tenant isolation", () => {
  it("rejects linking a harvest to another tenant's crop cycle", async () => {
    const prisma = buildPrisma();
    prisma.cropCycle.findFirst.mockResolvedValue(null);
    const service = new HarvestService(prisma as never);
    await expect(
      service.create(TENANT_A, { cropCycleId: "crop-b", harvestDate: "2026-02-01", quantityKg: 10 } as never)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.harvestRecord.create).not.toHaveBeenCalled();
  });

  it("tenant-less caller is denied (403) on list", () => {
    const prisma = buildPrisma();
    const service = new HarvestService(prisma as never);
    expect(() => service.list(null)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// Irrigation (field FK)
// ---------------------------------------------------------------------------
describe("Farm irrigation cross-tenant isolation", () => {
  it("rejects linking irrigation to another tenant's field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null);
    const service = new IrrigationService(prisma as never);
    await expect(
      service.create(TENANT_A, { fieldId: FIELD_B, method: "DRIP", startTime: "2026-01-01" } as never)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.irrigationLog.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Soil tests + spray logs (field/crop FK)
// ---------------------------------------------------------------------------
describe("Farm soil tests / spray logs cross-tenant isolation", () => {
  it("soil test create rejects cross-tenant field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null);
    const service = new SoilTestsService(prisma as never);
    await expect(
      service.create(TENANT_A, { fieldId: FIELD_B, testDate: "2026-01-01" } as never)
    ).rejects.toThrow(NotFoundException);
  });

  it("spray log create rejects cross-tenant crop cycle", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue({ id: FIELD_A }); // field ok
    prisma.cropCycle.findFirst.mockResolvedValue(null); // crop cycle not owned
    const service = new SprayLogsService(prisma as never);
    await expect(
      service.create(TENANT_A, {
        fieldId: FIELD_A,
        cropCycleId: "crop-b",
        chemicalName: "X",
        chemicalType: "PESTICIDE",
        unit: "L",
        date: "2026-01-01"
      } as never)
    ).rejects.toThrow(NotFoundException);
  });

  it("spray log list scopes to tenant", async () => {
    const prisma = buildPrisma();
    const service = new SprayLogsService(prisma as never);
    await service.list(TENANT_A);
    expect(prisma.sprayLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});

// ---------------------------------------------------------------------------
// Farm workers + attendance (worker FK)
// ---------------------------------------------------------------------------
describe("Farm workers cross-tenant isolation", () => {
  it("cannot record attendance against another tenant's worker", async () => {
    const prisma = buildPrisma();
    prisma.farmWorker.findFirst.mockResolvedValue(null);
    const service = new FarmWorkersService(prisma as never);
    await expect(
      service.recordAttendance(TENANT_A, { workerId: "worker-b", date: "2026-01-01", status: "PRESENT" } as never)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.attendanceLog.create).not.toHaveBeenCalled();
  });

  it("cannot list another tenant's worker attendance", async () => {
    const prisma = buildPrisma();
    prisma.farmWorker.findFirst.mockResolvedValue(null);
    const service = new FarmWorkersService(prisma as never);
    await expect(service.listAttendance("worker-b", TENANT_A)).rejects.toThrow(NotFoundException);
    expect(prisma.attendanceLog.findMany).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Livestock (animal FK)
// ---------------------------------------------------------------------------
describe("Farm livestock cross-tenant isolation", () => {
  it("cannot add a health record to another tenant's animal", async () => {
    const prisma = buildPrisma();
    prisma.livestockAnimal.findFirst.mockResolvedValue(null);
    const service = new LivestockService(prisma as never);
    await expect(
      service.createHealth(TENANT_A, { animalId: "animal-b", date: "2026-01-01", type: "CHECKUP", description: "x" } as never)
    ).rejects.toThrow(NotFoundException);
    expect(prisma.animalHealthRecord.create).not.toHaveBeenCalled();
  });

  it("scopes all-health list to the active tenant", async () => {
    const prisma = buildPrisma();
    const service = new LivestockService(prisma as never);
    await service.listAllHealth(TENANT_A);
    expect(prisma.animalHealthRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
  });
});

// ---------------------------------------------------------------------------
// Farm finance (reports/exports isolation + FK)
// ---------------------------------------------------------------------------
describe("Farm finance cross-tenant isolation", () => {
  it("summary aggregates only the active tenant's records", async () => {
    const prisma = buildPrisma();
    const service = new FarmFinanceService(prisma as never, new FarmCacheService());
    await service.summary(TENANT_A);
    expect(prisma.farmExpense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
    expect(prisma.farmIncome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });

  it("tenant-less caller is denied (403) on summary", async () => {
    const prisma = buildPrisma();
    const service = new FarmFinanceService(prisma as never, new FarmCacheService());
    await expect(service.summary(null)).rejects.toThrow(ForbiddenException);
  });

  it("cannot update another tenant's expense", async () => {
    const prisma = buildPrisma();
    prisma.farmExpense.findFirst.mockResolvedValue(null);
    const service = new FarmFinanceService(prisma as never, new FarmCacheService());
    await expect(service.updateExpense("exp-b", TENANT_A, { amountLkr: 5 })).rejects.toThrow(NotFoundException);
    expect(prisma.farmExpense.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Traceability (graph isolation + batch FK)
// ---------------------------------------------------------------------------
describe("Farm traceability graph isolation", () => {
  it("rejects a batch that links another tenant's field", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue(null);
    const service = new TraceabilityService(prisma as never, config);
    await expect(
      service.create(TENANT_A, { cropCycleId: "crop-a", fieldId: FIELD_B, harvestDate: "2026-01-01" })
    ).rejects.toThrow(NotFoundException);
    expect(prisma.traceabilityRecord.create).not.toHaveBeenCalled();
  });

  it("rejects a batch whose spray log ids include another tenant's records", async () => {
    const prisma = buildPrisma();
    prisma.field.findFirst.mockResolvedValue({ id: FIELD_A });
    prisma.cropCycle.findFirst.mockResolvedValue({ id: "crop-a" });
    prisma.sprayLog.findMany.mockResolvedValue([{ id: "spray-a" }]); // only 1 of 2 owned
    const service = new TraceabilityService(prisma as never, config);
    await expect(
      service.create(TENANT_A, {
        cropCycleId: "crop-a",
        fieldId: FIELD_A,
        sprayLogIds: ["spray-a", "spray-b"],
        harvestDate: "2026-01-01"
      })
    ).rejects.toThrow(NotFoundException);
    expect(prisma.traceabilityRecord.create).not.toHaveBeenCalled();
  });

  it("public lookup resolves linked nodes within the record's own tenant only", async () => {
    const prisma = buildPrisma();
    prisma.traceabilityRecord.findFirst.mockResolvedValue({
      batchCode: "NF-1",
      tenantId: TENANT_B,
      fieldId: FIELD_B,
      cropCycleId: "crop-b",
      harvestRecordId: null,
      soilTestId: null,
      sprayLogIds: [],
      harvestDate: new Date(),
      buyerName: null,
      certifications: []
    });
    const service = new TraceabilityService(prisma as never, config);
    await service.public("NF-1");
    expect(prisma.field.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FIELD_B, tenantId: TENANT_B } })
    );
    expect(prisma.cropCycle.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "crop-b", tenantId: TENANT_B } })
    );
  });
});

// ---------------------------------------------------------------------------
// Weather (tenant-owned observations; provider poll is platform-scoped)
// ---------------------------------------------------------------------------
describe("Farm weather cross-tenant isolation", () => {
  it("scopes tenant weather list to the active tenant", async () => {
    const prisma = buildPrisma();
    const service = new WeatherService(prisma as never, config, new FarmCacheService());
    await service.list(TENANT_A);
    expect(prisma.weatherLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } })
    );
  });

  it("tenant-less caller is denied (403) on manual entry", async () => {
    const prisma = buildPrisma();
    const service = new WeatherService(prisma as never, config, new FarmCacheService());
    await expect(service.manualEntry(null, { temperatureC: 20 })).rejects.toThrow(ForbiddenException);
  });

  it("manual entry forces the active tenant", async () => {
    const prisma = buildPrisma();
    const service = new WeatherService(prisma as never, config, new FarmCacheService());
    await service.manualEntry(TENANT_A, { temperatureC: 20 });
    expect(prisma.weatherLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT_A, source: "MANUAL" })
    });
  });
});

// ---------------------------------------------------------------------------
// Fallback to AsyncLocalStorage tenant context (no explicit tenantId)
// ---------------------------------------------------------------------------
describe("Farm services honor request-context tenant when no explicit id is passed", () => {
  it("uses the request-context tenant for list scoping", async () => {
    const prisma = buildPrisma();
    const service = new FieldsService(prisma as never);
    await requestContext.run(
      {
        actorId: "u1",
        actorEmail: null,
        actorRole: "FARM_MANAGER",
        tenantId: TENANT_A,
        module: "farm",
        ipAddress: null,
        userAgent: null,
        requestPath: null
      },
      async () => {
        await service.list(null);
      }
    );
    expect(prisma.field.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: TENANT_A }) })
    );
  });
});
