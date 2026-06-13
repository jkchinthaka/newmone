import {
  DisabledInventoryErpAdapter,
  InventoryErpAdapterService
} from "../src/modules/inventory/inventory-erp-adapter.service";

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
