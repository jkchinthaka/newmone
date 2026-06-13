import { BileetaInventoryErpAdapter } from "../src/modules/inventory/bileeta-inventory-erp.adapter";
import { ErpStockSyncService } from "../src/modules/inventory/erp-stock-sync.service";
import { publicErpStockSyncDryRunHasSensitiveFields } from "../src/modules/inventory/erp-stock-sync.mapper";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("Bileeta read-only stock sync", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("blocks live ERP calls when read-only sync is disabled", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as never;

    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "live",
        ERP_BASE_URL: "https://erp.example.com",
        ERP_API_KEY: "test-key",
        ERP_STOCK_ENDPOINT: "/stock",
        ERP_READ_ONLY_SYNC_ENABLED: false
      })
    );

    const readiness = adapter.checkReadiness();
    expect(readiness.state).toBe("disabled");
    expect(readiness.readOnlySyncEnabled).toBe(false);

    const fetchResult = await adapter.fetchStockBalances();
    expect(fetchResult.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns not_configured when live credentials are missing", () => {
    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "live",
        ERP_READ_ONLY_SYNC_ENABLED: true
      })
    );

    const readiness = adapter.checkReadiness();
    expect(readiness.state).toBe("not_configured");
    expect(readiness.missingKeys).toEqual(
      expect.arrayContaining(["ERP_BASE_URL", "ERP_API_KEY", "ERP_STOCK_ENDPOINT"])
    );
  });

  it("uses mock balances without HTTP in mock mode", async () => {
    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "mock"
      })
    );

    const fetchResult = await adapter.fetchStockBalances();
    expect(fetchResult.ok).toBe(true);
    expect(fetchResult.balances.length).toBeGreaterThan(0);
  });

  it("performs read-only GET when sandbox is fully configured", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ itemCode: "BRG-001", quantityOnHand: 5, warehouseCode: "MAIN" }]
      })
    }) as never;

    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "sandbox",
        ERP_BASE_URL: "https://sandbox.bileeta.example",
        ERP_API_KEY: "sandbox-key",
        ERP_STOCK_ENDPOINT: "/api/stock-balances",
        ERP_READ_ONLY_SYNC_ENABLED: true,
        ERP_WAREHOUSE_CODE: "MAIN",
        ERP_TIMEOUT_MS: 5000
      })
    );

    const fetchResult = await adapter.fetchStockBalances();
    expect(fetchResult.ok).toBe(true);
    expect(fetchResult.balances).toEqual([
      { partSku: "BRG-001", quantityOnHand: 5, warehouseCode: "MAIN" }
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://sandbox.bileeta.example/api/stock-balances"),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("dry-run compares tenant parts without exposing secrets", async () => {
    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "mock",
        ERP_STOCK_SYNC_APPLY_ENABLED: false
      })
    );
    const prisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "part-1",
            partNumber: "BRG-001",
            name: "Bearing",
            quantityInStock: 1
          }
        ])
      }
    } as never;

    const service = new ErpStockSyncService(prisma, adapter);
    const dryRun = await service.dryRunStockSync({ sub: "user-1", tenantId: "tenant-1" });

    expect(dryRun.status).toBe("completed");
    expect(dryRun.summary.changedItems).toBeGreaterThan(0);
    expect(publicErpStockSyncDryRunHasSensitiveFields(dryRun)).toBe(false);
    expect(JSON.stringify(dryRun)).not.toMatch(/sandbox-key|test-key|Bearer/i);
  });

  it("blocks local apply unless ERP_STOCK_SYNC_APPLY_ENABLED is true", async () => {
    const adapter = new BileetaInventoryErpAdapter(
      configService({
        ERP_MODE: "mock",
        ERP_STOCK_SYNC_APPLY_ENABLED: false
      })
    );
    const prisma = {
      sparePart: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn()
    } as unknown as ConstructorParameters<typeof ErpStockSyncService>[0];

    const service = new ErpStockSyncService(prisma, adapter);
    const result = await service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" });

    expect(result.status).toBe("blocked");
    expect(result.updatedCount).toBe(0);
    expect(prisma.sparePart.update).not.toHaveBeenCalled();
  });
});
