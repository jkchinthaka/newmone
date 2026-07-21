import { BadRequestException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { spawnSync } from "node:child_process";
import path from "node:path";

import { SELF_SERVICE_KEY, SelfService } from "../src/common/decorators/self-service.decorator";
import { PUBLIC_WEBHOOK_KEY, PublicWebhook } from "../src/common/decorators/public-webhook.decorator";
import {
  PLATFORM_SCOPED_KEY,
  PlatformScoped,
  TENANT_SCOPED_KEY,
  TenantScoped
} from "../src/common/decorators/tenant-scope.decorator";
import { BillingService } from "../src/modules/billing/billing.service";

const repoRoot = path.resolve(__dirname, "..", "..", "..");

describe("Authorization scope decorators", () => {
  const reflector = new Reflector();

  it("@SelfService marks a handler with self-service scope metadata", () => {
    class Dummy {
      @SelfService()
      handler(): void {}
    }
    expect(reflector.get(SELF_SERVICE_KEY, Dummy.prototype.handler)).toBe(true);
  });

  it("@PublicWebhook records the provider that must be signature-verified", () => {
    class Dummy {
      @PublicWebhook("stripe")
      handler(): void {}
    }
    expect(reflector.get(PUBLIC_WEBHOOK_KEY, Dummy.prototype.handler)).toBe("stripe");
  });

  it("@TenantScoped and @PlatformScoped set distinct scope metadata", () => {
    class Dummy {
      @TenantScoped()
      tenant(): void {}

      @PlatformScoped()
      platform(): void {}
    }
    expect(reflector.get(TENANT_SCOPED_KEY, Dummy.prototype.tenant)).toBe(true);
    expect(reflector.get(PLATFORM_SCOPED_KEY, Dummy.prototype.platform)).toBe(true);
  });
});

describe("RBAC static audit (CI gate)", () => {
  it("reports zero unscoped routes and zero high-risk TODO", () => {
    const result = spawnSync(process.execPath, ["scripts/audit-rbac.mjs", "--check"], {
      cwd: repoRoot,
      encoding: "utf8"
    });

    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).toContain("violations=0");
    expect(output).toContain("high_risk_todo=0");
    expect(result.status).toBe(0);
  }, 60000);
});

describe("Stripe webhook signature enforcement", () => {
  function buildService(env: Record<string, string | boolean>): BillingService {
    const config = {
      get: (key: string, def?: unknown) => (key in env ? env[key] : def)
    };
    const prisma = {} as never;
    const entitlements = {} as never;
    return new BillingService(prisma, config as never, entitlements);
  }

  it("rejects an unsigned webhook in production live mode (no signing secret)", async () => {
    const service = buildService({
      STRIPE_SECRET_KEY: "sk_test_dummy",
      BILLING_MODE: "live",
      NODE_ENV: "production",
      STRIPE_WEBHOOK_SECRET: "",
      ALLOW_UNSIGNED_STRIPE_WEBHOOK: false
    });

    await expect(
      service.processStripeWebhook(null, undefined, { type: "invoice.paid" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("does not attempt signature verification in mock mode", async () => {
    const service = buildService({
      BILLING_MODE: "mock",
      NODE_ENV: "development"
    });

    await expect(
      service.processStripeWebhook(null, undefined, { type: "invoice.paid" })
    ).resolves.toEqual({ received: true, mode: "mock" });
  });
});
