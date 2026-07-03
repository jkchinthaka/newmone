import { ForbiddenException } from "@nestjs/common";
import { ErpImportType, RoleName } from "@prisma/client";

import { BileetaErpConnector, DisabledErpConnector, MockErpConnector, resolveErpSyncMode } from "../src/modules/erp-integration/connectors/erp-connectors";
import { ERP_LIVE_NOT_CONFIGURED_MESSAGE } from "../src/modules/erp-integration/erp.constants";
import { ErpConfigService } from "../src/modules/erp-integration/erp-config.service";
import { ErpImportService } from "../src/modules/erp-integration/erp-import.service";
import { ErpMappingService } from "../src/modules/erp-integration/erp-mapping.service";
import { ErpMockSyncService } from "../src/modules/erp-integration/erp-mock-sync.service";
import { ErpReconciliationService } from "../src/modules/erp-integration/erp-reconciliation.service";

const mockConfig = (values: Record<string, string>) => ({
  get: (key: string) => values[key],
  getOrThrow: (key: string) => values[key]
});

const mockCtx: {
  actorId: string;
  actorRole: RoleName;
  tenantId: string;
  permissions: string[];
} = {
  actorId: "admin-1",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-1",
  permissions: ["erp.view", "erp.manage", "erp.import", "erp.reconcile"]
};

jest.mock("../src/common/context/request-context", () => ({
  requestContext: { get: jest.fn(() => mockCtx) }
}));

const buildPrisma = () => ({
  erpFieldMapping: { count: jest.fn(), findMany: jest.fn(), create: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  erpImportBatch: { count: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  erpReconciliationMismatch: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), createMany: jest.fn(), update: jest.fn() },
  erpAccessChecklistItem: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  erpMockSyncRun: { findFirst: jest.fn(), create: jest.fn() },
  auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
});

describe("ERP Integration Readiness (UAT-029)", () => {
  beforeEach(() => {
    mockCtx.permissions = ["erp.view", "erp.manage", "erp.import", "erp.reconcile"];
    mockCtx.actorRole = RoleName.ADMIN;
    jest.clearAllMocks();
  });

  it("ERP status disabled by default", () => {
    const config = new ErpConfigService(mockConfig({ ERP_SYNC_MODE: "disabled" }) as never);
    expect(config.getSyncMode()).toBe("disabled");
    const status = config.getSafeConfigStatus();
    expect(status.syncMode).toBe("disabled");
    expect(status.apiKeyConfigured).toBe(false);
    expect(status).not.toHaveProperty("password");
    expect(status).not.toHaveProperty("apiKey");
    expect(status).not.toHaveProperty("apiPassword");
    expect(JSON.stringify(status)).not.toMatch(/"password"\s*:\s*"[^"]+"/i);
  });

  it("live mode blocked without credentials", async () => {
    const config = new ErpConfigService(mockConfig({ ERP_SYNC_MODE: "live" }) as never);
    const status = config.getSafeConfigStatus();
    expect(status.liveIntegrationAvailable).toBe(false);
    expect(status.liveNotConfiguredMessage).toBe(ERP_LIVE_NOT_CONFIGURED_MESSAGE);

    const connector = new BileetaErpConnector(mockConfig({ ERP_SYNC_MODE: "live" }) as never);
    await expect(connector.fetchEmployees()).rejects.toThrow(ERP_LIVE_NOT_CONFIGURED_MESSAGE);
  });

  it("mock connector returns sample data without HTTP", async () => {
    const connector = new MockErpConnector();
    const employees = await connector.fetchEmployees();
    expect(employees.count).toBeGreaterThan(0);
    expect(employees.readOnly).toBe(true);
  });

  it("disabled connector blocks sync", async () => {
    const connector = new DisabledErpConnector();
    await expect(connector.fetchVendors()).rejects.toThrow(/disabled/i);
  });

  it("Bileeta connector does not call real API", async () => {
    const connector = new BileetaErpConnector(
      mockConfig({
        ERP_SYNC_MODE: "live",
        BILEETA_API_BASE_URL: "https://erp.example.com",
        BILEETA_API_KEY: "test-key"
      }) as never
    );
    await expect(connector.fetchItems()).rejects.toThrow(/not enabled in this build/i);
  });

  it("mapping create works", async () => {
    const prisma = buildPrisma();
    prisma.erpFieldMapping.create.mockResolvedValue({ id: "m1", sourceField: "code", targetModel: "Employee", targetField: "employeeNo" });
    const service = new ErpMappingService(prisma as never);
    const created = await service.create({ sourceField: "code", targetModel: "Employee", targetField: "employeeNo" });
    expect(created.id).toBe("m1");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("mock sync works in mock mode", async () => {
    const prisma = buildPrisma();
    prisma.erpMockSyncRun.findFirst.mockResolvedValue(null);
    prisma.erpMockSyncRun.create.mockResolvedValue({ id: "run-1", recordsFetched: 8 });
    const service = new ErpMockSyncService(prisma as never, mockConfig({ ERP_SYNC_MODE: "mock" }) as never);
    const result = await service.runMockSync({});
    expect(result.productionDataModified).toBe(false);
    expect(result.run.recordsFetched).toBeGreaterThan(0);
  });

  it("import batch dry-run works", async () => {
    const prisma = buildPrisma();
    prisma.erpImportBatch.count.mockResolvedValue(0);
    prisma.erpImportBatch.create.mockResolvedValue({
      id: "b1",
      batchNo: "IMP-00001",
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0,
      status: "UPLOADED"
    });
    prisma.erpImportBatch.findFirst.mockResolvedValue({
      id: "b1",
      status: "UPLOADED",
      validRows: 1,
      invalidRows: 0,
      duplicateRows: 0
    });
    prisma.erpImportBatch.update.mockResolvedValue({ id: "b1", status: "READY_FOR_REVIEW" });

    const importService = new ErpImportService(prisma as never, mockConfig({ ERP_SYNC_MODE: "file_import" }) as never);
    const { batch } = await importService.createBatch({
      importType: ErpImportType.EMPLOYEES,
      csvContent: "employeeCode,name\nEMP-001,Test User"
    });
    expect(batch.batchNo).toBe("IMP-00001");

    const dryRun = await importService.dryRun("b1");
    expect(dryRun.status).toBe("READY_FOR_REVIEW");
  });

  it("duplicate rows detected in import", async () => {
    const prisma = buildPrisma();
    prisma.erpImportBatch.count.mockResolvedValue(0);
    prisma.erpImportBatch.create.mockResolvedValue({ id: "b2", duplicateRows: 1, validRows: 1, invalidRows: 0 });
    const importService = new ErpImportService(prisma as never, mockConfig({ ERP_SYNC_MODE: "mock" }) as never);
    const { batch } = await importService.createBatch({
      importType: ErpImportType.VENDORS,
      csvContent: "vendorCode,vendorName\nV1,A\nV1,B"
    });
    expect(batch.duplicateRows).toBe(1);
  });

  it("reconciliation mismatch review writes audit", async () => {
    const prisma = buildPrisma();
    prisma.erpReconciliationMismatch.count.mockResolvedValue(1);
    prisma.erpReconciliationMismatch.findMany.mockResolvedValue([]);
    prisma.erpReconciliationMismatch.findFirst.mockResolvedValue({
      id: "r1",
      status: "OPEN",
      maintainProValue: "8"
    });
    prisma.erpReconciliationMismatch.update.mockResolvedValue({ id: "r1", status: "REVIEWED" });
    const service = new ErpReconciliationService(prisma as never);
    await service.review("r1", { reason: "Reviewed by admin" });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("unauthorized user blocked from mappings", async () => {
    mockCtx.permissions = [];
    mockCtx.actorRole = RoleName.TECHNICIAN;
    const prisma = buildPrisma();
    const service = new ErpMappingService(prisma as never);
    await expect(service.create({ sourceField: "x", targetModel: "Y", targetField: "z" })).rejects.toThrow(ForbiddenException);
  });

  it("resolveErpSyncMode defaults to disabled", () => {
    expect(resolveErpSyncMode(mockConfig({}) as never)).toBe("disabled");
  });
});
