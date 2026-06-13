import {
  DisabledInventoryErpAdapter,
  InventoryErpAdapterService
} from "../src/modules/inventory/inventory-erp-adapter.service";
import { BileetaInventoryErpAdapter } from "../src/modules/inventory/bileeta-inventory-erp.adapter";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback
    )
  }) as never;

describe("Inventory ERP adapter foundation", () => {
  it("reports disabled by default", () => {
    const adapter = new DisabledInventoryErpAdapter(
      configService({
        ERP_MODE: "disabled"
      })
    );

    expect(adapter.describeReadiness()).toMatchObject({
      mode: "disabled",
      state: "disabled",
      configured: false
    });
  });

  it("reports missing live config honestly without making HTTP calls", async () => {
    const adapter = new InventoryErpAdapterService(
      new DisabledInventoryErpAdapter(
        configService({
          ERP_MODE: "live"
        })
      )
    );

    const readiness = adapter.describeReadiness();
    expect(readiness.state).toBe("not_configured");
    expect(readiness.missingKeys.length).toBeGreaterThan(0);

    const stock = await adapter.getStockBalance("PART-001");
    expect(stock.ok).toBe(false);
    expect(stock.message).toMatch(/blocked|disabled/i);
  });

  it("keeps production mock safety intact", () => {
    const adapter = new DisabledInventoryErpAdapter(
      configService({
        NODE_ENV: "production",
        ERP_MODE: "mock",
        ALLOW_MOCK_IN_PRODUCTION: false
      })
    );

    expect(adapter.describeReadiness()).toMatchObject({
      mode: "mock",
      state: "misconfigured",
      blockedInProduction: true,
      configured: false
    });
  });
});

describe("Bileeta stock sync adapter foundation", () => {
  it("reports disabled read sync until ERP_READ_ONLY_SYNC_ENABLED is true", () => {
    const adapter = new BileetaInventoryErpAdapter(
      ({
        get: jest.fn((key: string, fallback?: unknown) => {
          const values: Record<string, unknown> = {
            ERP_MODE: "live",
            ERP_BASE_URL: "https://erp.example.com",
            ERP_API_KEY: "present",
            ERP_STOCK_ENDPOINT: "/stock",
            ERP_READ_ONLY_SYNC_ENABLED: false
          };
          return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : fallback;
        })
      }) as never
    );

    expect(adapter.checkReadiness()).toMatchObject({
      state: "disabled",
      readOnlySyncEnabled: false
    });
  });
});
