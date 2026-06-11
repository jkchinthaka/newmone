import {
  shouldProtectSwaggerWithBasicAuth,
  shouldSetupSwagger,
  verifySwaggerBasicAuth
} from "../src/bootstrap/swagger-guard";

describe("shouldSetupSwagger", () => {
  it("is enabled outside production regardless of other flags", () => {
    expect(shouldSetupSwagger({ isProd: false, swaggerEnabled: false })).toBe(true);
  });

  it("is disabled in production by default", () => {
    expect(shouldSetupSwagger({ isProd: true, swaggerEnabled: false })).toBe(false);
  });

  it("is disabled in production when enabled but missing credentials", () => {
    expect(shouldSetupSwagger({ isProd: true, swaggerEnabled: true })).toBe(false);
    expect(shouldSetupSwagger({ isProd: true, swaggerEnabled: true, swaggerUser: "admin" })).toBe(false);
  });

  it("is enabled in production when enabled with both credentials set", () => {
    expect(
      shouldSetupSwagger({
        isProd: true,
        swaggerEnabled: true,
        swaggerUser: "admin",
        swaggerPassword: "secret"
      })
    ).toBe(true);
  });
});

describe("shouldProtectSwaggerWithBasicAuth", () => {
  it("is false outside production", () => {
    expect(
      shouldProtectSwaggerWithBasicAuth({
        isProd: false,
        swaggerEnabled: true,
        swaggerUser: "admin",
        swaggerPassword: "secret"
      })
    ).toBe(false);
  });

  it("is true in production with credentials configured", () => {
    expect(
      shouldProtectSwaggerWithBasicAuth({
        isProd: true,
        swaggerEnabled: true,
        swaggerUser: "admin",
        swaggerPassword: "secret"
      })
    ).toBe(true);
  });
});

describe("verifySwaggerBasicAuth", () => {
  const encode = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

  it("accepts matching credentials", () => {
    expect(verifySwaggerBasicAuth(encode("admin", "secret"), "admin", "secret")).toBe(true);
  });

  it("rejects wrong password", () => {
    expect(verifySwaggerBasicAuth(encode("admin", "wrong"), "admin", "secret")).toBe(false);
  });

  it("rejects wrong user", () => {
    expect(verifySwaggerBasicAuth(encode("other", "secret"), "admin", "secret")).toBe(false);
  });

  it("rejects missing Authorization header", () => {
    expect(verifySwaggerBasicAuth(undefined, "admin", "secret")).toBe(false);
  });

  it("rejects non-Basic Authorization headers", () => {
    expect(verifySwaggerBasicAuth("Bearer sometoken", "admin", "secret")).toBe(false);
  });
});
