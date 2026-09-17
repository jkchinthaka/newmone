import { ErpDashboardService } from "../src/modules/erp-integration/erp-dashboard.service";
import { sanitizeErpErrorMessage } from "../src/modules/inventory/erp-error-sanitize.util";

describe("ERP exception center", () => {
  it("sanitizes secrets from error messages", () => {
    const raw = "Authorization: Bearer abc.def.ghi failed calling https://erp.example/api api_key=secret123";
    const cleaned = sanitizeErpErrorMessage(raw);
    expect(cleaned).not.toMatch(/abc\.def\.ghi/);
    expect(cleaned).not.toMatch(/secret123/);
    expect(cleaned).not.toMatch(/https:\/\//);
  });

  it("aggregates failed syncs without returning payloads", async () => {
    const prisma = {
      purchaseOrderErpSync: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sync-1",
            tenantId: "t1",
            purchaseOrderId: "po-1",
            provider: "MOCK_ERP",
            status: "FAILED",
            attempt: 3,
            lastAttemptAt: new Date(),
            nextRetryAt: null,
            errorMessage: "Bearer tokensecret failed",
            errorCode: "TIMEOUT",
            idempotencyKey: "idem-1",
            createdAt: new Date()
          }
        ])
      },
      erpImportBatch: { findMany: jest.fn().mockResolvedValue([]) },
      erpReconciliationMismatch: { findMany: jest.fn().mockResolvedValue([]) }
    } as never;

    const service = new ErpDashboardService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    Object.defineProperty(service, "canView", { value: () => true });

    const result = await service.getExceptions({ limit: 10 });
    expect(result.count).toBe(1);
    expect(result.items[0].lastError).not.toMatch(/tokensecret/);
    expect(result.items[0]).not.toHaveProperty("requestPayload");
    expect(result.items[0]).not.toHaveProperty("responsePayload");
  });
});
