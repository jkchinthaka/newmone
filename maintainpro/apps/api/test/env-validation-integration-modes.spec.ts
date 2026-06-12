import { envValidationSchema } from "../src/config/env.validation";

describe("env validation integration mode guards", () => {
  it("rejects mock integration modes in production when ALLOW_MOCK_IN_PRODUCTION=false", () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: "production",
      DATABASE_URL: "mongodb://localhost:27017/app",
      JWT_SECRET: "secret",
      REDIS_REQUIRED_IN_PRODUCTION: false,
      ALLOW_MOCK_IN_PRODUCTION: false,
      ERP_MODE: "mock"
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain("Mock integration modes are blocked in production");
  });

  it("allows mock integration modes outside production", () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: "development",
      DATABASE_URL: "mongodb://localhost:27017/app",
      JWT_SECRET: "secret",
      ERP_MODE: "mock",
      BILLING_MODE: "mock"
    });

    expect(error).toBeUndefined();
  });
});
