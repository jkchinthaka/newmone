import { BileetaInventoryErpAdapter } from "../src/modules/inventory/bileeta-inventory-erp.adapter";
import { ErpStockSyncService } from "../src/modules/inventory/erp-stock-sync.service";
import { publicErpStockSyncDryRunHasSensitiveFields } from "../src/modules/inventory/erp-stock-sync.mapper";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

const mockAdjustEngine = (partState?: { id: string; quantityInStock: number }, failPartIds: string[] = []) => ({
  adjust: jest.fn().mockImplementation(async (input: { partId: string; quantity: number; direction: "IN" | "OUT" }) => {
    if (failPartIds.includes(input.partId)) {
      throw new Error("write conflict");
    }
    if (partState && input.partId === partState.id) {
      partState.quantityInStock += input.direction === "IN" ? input.quantity : -input.quantity;
    }
    return {
      part: { id: input.partId, quantityInStock: partState?.quantityInStock ?? 0 },
      movement: { id: "mov-1", type: "ADJUSTMENT_IN", quantity: input.quantity },
      replayed: false
    };
  })
});

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

  it("MP-004: apply uses absolute ERP quantity and skips already-applied on retry", async () => {
    const adapter = {
      checkReadiness: () => ({
        adapterId: "bileeta",
        mode: "mock",
        state: "configured",
        readOnlySyncEnabled: true,
        applyEnabled: true,
        stockEndpointPresent: true,
        baseUrlPresent: true,
        credentialPresent: true,
        message: "ready",
        missingKeys: []
      }),
      fetchStockBalances: jest.fn().mockResolvedValue({
        ok: true,
        mode: "mock",
        balances: [{ partSku: "BRG-001", quantityOnHand: 10, warehouseCode: "MAIN" }],
        message: "ok"
      })
    } as unknown as BileetaInventoryErpAdapter;

    const partState = { id: "part-1", quantityInStock: 1 };
    const prisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          { id: "part-1", partNumber: "BRG-001", name: "Bearing", quantityInStock: 1 }
        ]),
        findFirst: jest.fn().mockImplementation(async () => ({ ...partState })),
        update: jest.fn().mockImplementation(async ({ data }: { data: { quantityInStock: number } }) => {
          partState.quantityInStock = data.quantityInStock;
          return partState;
        })
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: "mov-1" }) },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
    } as unknown as ConstructorParameters<typeof ErpStockSyncService>[0];

    const engine = mockAdjustEngine(partState);
    const service = new ErpStockSyncService(prisma, adapter, engine as never);
    const first = await service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" });
    expect(first.status).toBe("completed");
    expect(first.updatedCount).toBe(1);
    expect(partState.quantityInStock).toBe(10);
    expect(engine.adjust).toHaveBeenCalledTimes(1);

    const second = await service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" });
    expect(second.status).toBe("completed");
    expect(second.updatedCount).toBe(0);
    expect(second.skippedCount).toBeGreaterThanOrEqual(1);
    expect(engine.adjust).toHaveBeenCalledTimes(1);
  });

  it("MP-004: apply with supplied erpBalances does not refetch ERP", async () => {
    const adapter = {
      checkReadiness: () => ({
        adapterId: "bileeta",
        mode: "mock",
        state: "configured",
        readOnlySyncEnabled: true,
        applyEnabled: true,
        stockEndpointPresent: true,
        baseUrlPresent: true,
        credentialPresent: true,
        message: "ready",
        missingKeys: []
      }),
      fetchStockBalances: jest.fn()
    } as unknown as BileetaInventoryErpAdapter;

    const prisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          { id: "part-1", partNumber: "BRG-001", name: "Bearing", quantityInStock: 1 }
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: "part-1", quantityInStock: 1 }),
        update: jest.fn().mockResolvedValue({ id: "part-1", quantityInStock: 7 })
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: "mov-1" }) },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
    } as unknown as ConstructorParameters<typeof ErpStockSyncService>[0];

    const service = new ErpStockSyncService(prisma, adapter, mockAdjustEngine() as never);
    const result = await service.applyStockSnapshot(
      { sub: "user-1", tenantId: "tenant-1" },
      { erpBalances: [{ partSku: "BRG-001", quantityOnHand: 7, warehouseCode: "MAIN" }] }
    );

    expect(result.status).toBe("completed");
    expect(result.updatedCount).toBe(1);
    expect(adapter.fetchStockBalances).not.toHaveBeenCalled();
  });

  it("MP-004: partial row failure returns status=partial and never claims full success", async () => {
    const adapter = {
      checkReadiness: () => ({
        adapterId: "bileeta",
        mode: "mock",
        state: "configured",
        readOnlySyncEnabled: true,
        applyEnabled: true,
        stockEndpointPresent: true,
        baseUrlPresent: true,
        credentialPresent: true,
        message: "ready",
        missingKeys: []
      }),
      fetchStockBalances: jest.fn().mockResolvedValue({
        ok: true,
        mode: "mock",
        balances: [
          { partSku: "BRG-001", quantityOnHand: 10, warehouseCode: "MAIN" },
          { partSku: "OIL-001", quantityOnHand: 5, warehouseCode: "MAIN" }
        ],
        message: "ok"
      })
    } as unknown as BileetaInventoryErpAdapter;

    let oilCalls = 0;
    const prisma = {
      sparePart: {
        findMany: jest.fn().mockResolvedValue([
          { id: "part-1", partNumber: "BRG-001", name: "Bearing", quantityInStock: 1 },
          { id: "part-2", partNumber: "OIL-001", name: "Oil", quantityInStock: 1 }
        ]),
        findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
          if (where.id === "part-1") return { id: "part-1", quantityInStock: 1 };
          return { id: "part-2", quantityInStock: 1 };
        }),
        update: jest.fn()
      },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn(async () => {
        oilCalls += 1;
        if (oilCalls === 2) {
          throw new Error("write conflict");
        }
        return [];
      })
    } as unknown as ConstructorParameters<typeof ErpStockSyncService>[0];

    const engine = mockAdjustEngine(undefined, ["part-2"]);
    const service = new ErpStockSyncService(prisma, adapter, engine as never);
    const result = await service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" });

    expect(result.status).toBe("partial");
    expect(result.failedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.message).toMatch(/Partial/i);
  });

  it("MP-004: concurrent identical applies are serialized per tenant", async () => {
    const adapter = {
      checkReadiness: () => ({
        adapterId: "bileeta",
        mode: "mock",
        state: "configured",
        readOnlySyncEnabled: true,
        applyEnabled: true,
        stockEndpointPresent: true,
        baseUrlPresent: true,
        credentialPresent: true,
        message: "ready",
        missingKeys: []
      }),
      fetchStockBalances: jest.fn().mockResolvedValue({
        ok: true,
        mode: "mock",
        balances: [{ partSku: "BRG-001", quantityOnHand: 10, warehouseCode: "MAIN" }],
        message: "ok"
      })
    } as unknown as BileetaInventoryErpAdapter;

    const partState = { id: "part-1", quantityInStock: 1 };
    let inFlight = 0;
    let maxInFlight = 0;

    const prisma = {
      sparePart: {
        findMany: jest.fn().mockImplementation(async () => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 20));
          inFlight -= 1;
          return [
            {
              id: "part-1",
              partNumber: "BRG-001",
              name: "Bearing",
              quantityInStock: partState.quantityInStock
            }
          ];
        }),
        findFirst: jest.fn().mockImplementation(async () => ({ ...partState })),
        update: jest.fn().mockImplementation(async ({ data }: { data: { quantityInStock: number } }) => {
          partState.quantityInStock = data.quantityInStock;
          return partState;
        })
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: "mov-1" }) },
      $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
    } as unknown as ConstructorParameters<typeof ErpStockSyncService>[0];

    const engine = mockAdjustEngine(partState);
    const service = new ErpStockSyncService(prisma, adapter, engine as never);
    const [a, b] = await Promise.all([
      service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" }),
      service.applyStockSnapshot({ sub: "user-1", tenantId: "tenant-1" })
    ]);

    expect(maxInFlight).toBe(1);
    expect(a.status === "completed" || b.status === "completed").toBe(true);
    expect(engine.adjust).toHaveBeenCalledTimes(1);
  });
});
