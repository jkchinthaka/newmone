/**
 * Prove real envValidationSchema rejects NODE_ENV=production + E2E_TEST_MODE=true.
 */
import "dotenv/config";
import { envValidationSchema } from "../src/config/env.validation";

const base = {
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "sqlserver://localhost:1433;database=x;user=sa;password=x;encrypt=true;trustServerCertificate=true",
  JWT_SECRET: "d2-proof-jwt-secret-not-for-production-use-32chars",
  REDIS_REQUIRED_IN_PRODUCTION: false,
  ALLOW_MOCK_IN_PRODUCTION: true,
  ERP_MODE: "disabled",
  BILLING_MODE: "disabled",
  SMS_MODE: "disabled",
  PUSH_MODE: "disabled",
  EMAIL_MODE: "disabled"
};

const bad = envValidationSchema.validate({
  ...base,
  NODE_ENV: "production",
  E2E_TEST_MODE: true
});

const good = envValidationSchema.validate({
  ...base,
  NODE_ENV: "production",
  E2E_TEST_MODE: false
});

const e2eMessage = String(bad.error?.message ?? bad.error?.details?.map((d) => d.message).join("; ") ?? "");
const e2eRejectedForReason = /E2E_TEST_MODE/i.test(e2eMessage);

console.log(
  JSON.stringify(
    {
      productionWithE2ERejected: Boolean(bad.error),
      e2eRejectedForReason,
      productionWithE2EMessage: e2eMessage,
      productionWithoutE2EOk: !good.error,
      productionWithoutE2EError: good.error?.message ?? null
    },
    null,
    2
  )
);

if (!bad.error || !e2eRejectedForReason || good.error) process.exit(1);
