import { ErpSyncProviderService } from "../src/modules/inventory/erp-sync-provider.service";

const configService = (values: Record<string, unknown>) => ({
  get: jest.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback))
});

describe("ErpSyncProviderService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("blocks mock ERP in production unless explicitly allowed", () => {
    const service = new ErpSyncProviderService(
      configService({
        NODE_ENV: "production",
        ERP_SYNC_PROVIDER: "mock",
        ERP_SYNC_ALLOW_MOCK_IN_PRODUCTION: false
      }) as never
    );

    expect(service.describeProvider()).toMatchObject({ mode: "mock", configured: false });
    expect(() => service.assertCanUseSelectedProvider()).toThrow("blocked in production");
  });

  it("sends purchase orders through the HTTP ERP provider", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ accepted: true, providerRef: "ERP-100" }))
    }) as never;

    const service = new ErpSyncProviderService(
      configService({
        NODE_ENV: "production",
        ERP_SYNC_PROVIDER: "http",
        ERP_API_URL: "https://erp.example.com/purchase-orders",
        ERP_API_KEY: "erp-key",
        ERP_AUTH_HEADER: "Authorization",
        ERP_TIMEOUT_MS: 15000
      }) as never
    );

    const result = await service.syncPurchaseOrder({
      poNumber: "PO-1",
      totalAmount: 1250,
      note: "sync"
    });

    expect(result).toMatchObject({ accepted: true, providerRef: "ERP-100" });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://erp.example.com/purchase-orders",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer erp-key" })
      })
    );
  });
});