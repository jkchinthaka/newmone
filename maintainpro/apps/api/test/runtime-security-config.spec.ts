import {
  assertProductionRuntimeSecurity,
  resolveCookieSecurityConfig,
  validateUrlCookieConsistency
} from "../../web/lib/runtime-security-config";

describe("runtime security config (HTTP-CONFIG / COOKIE)", () => {
  it("HTTP-CONFIG-001: production defaults to secure cookies when flags missing", () => {
    const config = resolveCookieSecurityConfig({
      NODE_ENV: "production"
    });
    expect(config.secureCookies).toBe(true);
    expect(config.httpCompatibilityMode).toBe(false);
  });

  it("HTTP-CONFIG-002: production COOKIE_SECURE=true stays secure", () => {
    const config = resolveCookieSecurityConfig({
      NODE_ENV: "production",
      COOKIE_SECURE: "true"
    });
    expect(config.secureCookies).toBe(true);
  });

  it("HTTP-CONFIG-003: production COOKIE_SECURE=false without ALLOW_INSECURE_HTTP fails", () => {
    expect(() =>
      resolveCookieSecurityConfig({
        NODE_ENV: "production",
        COOKIE_SECURE: "false"
      })
    ).toThrow(/ALLOW_INSECURE_HTTP/);
  });

  it("COOKIE-001: production COOKIE_SECURE=false with ALLOW_INSECURE_HTTP=false fails", () => {
    expect(() =>
      resolveCookieSecurityConfig({
        NODE_ENV: "production",
        COOKIE_SECURE: "false",
        ALLOW_INSECURE_HTTP: "false"
      })
    ).toThrow(/ALLOW_INSECURE_HTTP/);
  });

  it("COOKIE-002: approved HTTP compatibility mode requires dual opt-in", () => {
    const config = resolveCookieSecurityConfig({
      NODE_ENV: "production",
      COOKIE_SECURE: "false",
      ALLOW_INSECURE_HTTP: "true"
    });
    expect(config.secureCookies).toBe(false);
    expect(config.httpCompatibilityMode).toBe(true);
  });

  it("COOKIE-003: development defaults to non-secure cookies", () => {
    const config = resolveCookieSecurityConfig({
      NODE_ENV: "development"
    });
    expect(config.secureCookies).toBe(false);
  });

  it("rejects invalid boolean strings without printing secret-like values", () => {
    expect(() =>
      resolveCookieSecurityConfig({
        NODE_ENV: "production",
        COOKIE_SECURE: "maybe"
      })
    ).toThrow(/COOKIE_SECURE/);

    try {
      resolveCookieSecurityConfig({
        NODE_ENV: "production",
        COOKIE_SECURE: "super-secret-value-should-not-leak"
      });
      fail("expected throw");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("super-secret-value-should-not-leak");
      expect(message).toContain("COOKIE_SECURE");
    }
  });

  it("ALLOW_INSECURE_HTTP=true alone does not disable Secure cookies", () => {
    const config = resolveCookieSecurityConfig({
      NODE_ENV: "production",
      ALLOW_INSECURE_HTTP: "true"
    });
    expect(config.secureCookies).toBe(true);
    expect(config.httpCompatibilityMode).toBe(false);
  });

  it("fails closed for production HTTP origin with Secure cookies", () => {
    const result = validateUrlCookieConsistency({
      NODE_ENV: "production",
      COOKIE_SECURE: "true",
      FRONTEND_URL: "http://example.invalid",
      NEXT_PUBLIC_API_ORIGIN: "http://example.invalid",
      CORS_ORIGIN: "http://example.invalid"
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("FRONTEND_URL"))).toBe(true);
    expect(result.errors.join(" ")).not.toMatch(/example\.invalid\/secret/);
  });

  it("fails closed for production HTTPS origin with COOKIE_SECURE=false", () => {
    const result = validateUrlCookieConsistency({
      NODE_ENV: "production",
      COOKIE_SECURE: "false",
      ALLOW_INSECURE_HTTP: "true",
      FRONTEND_URL: "https://example.invalid"
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("https:"))).toBe(true);
  });

  it("warns when ALLOW_INSECURE_HTTP=true but Secure cookies remain on", () => {
    const result = validateUrlCookieConsistency({
      NODE_ENV: "production",
      ALLOW_INSECURE_HTTP: "true",
      COOKIE_SECURE: "true",
      FRONTEND_URL: "https://example.invalid"
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.some((w) => /NOT active/i.test(w))).toBe(true);
  });

  it("assertProductionRuntimeSecurity throws on contradictory production HTTP+Secure", () => {
    expect(() =>
      assertProductionRuntimeSecurity({
        NODE_ENV: "production",
        FRONTEND_URL: "http://example.invalid",
        COOKIE_SECURE: "true"
      })
    ).toThrow(/http:/i);
  });
});
