import { ForbiddenException } from "@nestjs/common";
import { BillingInterval, SubscriptionStatus } from "@prisma/client";

import { BillingService } from "../src/modules/billing/billing.service";

const configService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string, fallback?: unknown) => (key in values ? values[key] : fallback))
  }) as any;

describe("BillingService integration modes", () => {
  it("blocks billing mock mode in production when mocks are not allowed", async () => {
    const prisma = {
      plan: { findUnique: jest.fn() }
    } as any;

    const service = new BillingService(
      prisma,
      configService({
        NODE_ENV: "production",
        BILLING_MODE: "mock",
        ALLOW_MOCK_IN_PRODUCTION: false
      }),
      {} as any
    );

    await expect(
      service.createCheckoutSession("user-1", "tenant-1", {
        planCode: "STARTER",
        billingInterval: BillingInterval.MONTHLY,
        seats: 5
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("allows billing mock mode in development and returns mock checkout response", async () => {
    const prisma = {
      plan: {
        findUnique: jest.fn().mockResolvedValue({
          id: "plan-1",
          code: "STARTER",
          name: "Starter",
          description: "Starter plan",
          currency: "USD",
          priceMonthly: 29,
          priceYearly: 290,
          metadata: null,
          isActive: true,
          entitlements: []
        })
      },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({
          id: "sub-1",
          tenantId: "tenant-1",
          status: SubscriptionStatus.ACTIVE,
          billingInterval: BillingInterval.MONTHLY,
          seats: 5,
          plan: { entitlements: [] }
        })
      }
    } as any;

    const service = new BillingService(
      prisma,
      configService({
        NODE_ENV: "development",
        BILLING_MODE: "mock",
        FRONTEND_URL: "http://localhost:3001"
      }),
      {} as any
    );

    const result = await service.createCheckoutSession("user-1", "tenant-1", {
      planCode: "STARTER",
      billingInterval: BillingInterval.MONTHLY,
      seats: 5
    });

    expect(result.mode).toBe("mock");
    expect(result.subscription?.status).toBe(SubscriptionStatus.ACTIVE);
    expect(prisma.subscription.create).toHaveBeenCalled();
  });
});
