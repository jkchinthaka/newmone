import {
  BFF_CSRF_EXEMPTIONS,
  browserVisibleBodyContainsTokenLiterals,
  extractAuthTokens,
  isBffCsrfExempt,
  stripAuthTokensFromBody
} from "../../web/lib/bff-auth";
import { csrfCookieOptions, sessionCookieOptions } from "../../web/lib/session-cookies";

describe("BFF auth helpers (BFF / CSRF / AUTH-STORAGE)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("BFF-001: extracts access and refresh tokens from nested login payloads", () => {
    expect(
      extractAuthTokens({
        data: {
          accessToken: "access-a",
          refreshToken: "refresh-b",
          user: { id: "1" }
        }
      })
    ).toEqual({ accessToken: "access-a", refreshToken: "refresh-b" });
  });

  it("BFF-002: strips tokens from browser-visible response bodies", () => {
    const stripped = stripAuthTokensFromBody({
      data: {
        accessToken: "access-a",
        refreshToken: "refresh-b",
        user: { email: "admin@example.invalid" }
      },
      message: "Login successful"
    }) as { data: Record<string, unknown> };

    expect(stripped.data.accessToken).toBeUndefined();
    expect(stripped.data.refreshToken).toBeUndefined();
    expect(stripped.data.user).toEqual({ email: "admin@example.invalid" });
    expect(browserVisibleBodyContainsTokenLiterals(stripped)).toBe(false);
  });

  it("BFF-003: CSRF exemptions are documented and limited", () => {
    expect(isBffCsrfExempt("auth/login")).toBe(true);
    expect(isBffCsrfExempt("work-orders")).toBe(false);
    expect(isBffCsrfExempt("billing/webhooks/stripe")).toBe(true);
    for (const rule of BFF_CSRF_EXEMPTIONS) {
      expect(rule.reason.length).toBeGreaterThan(5);
      expect(rule.authRequirement.length).toBeGreaterThan(0);
      expect(rule.abuseRisk.length).toBeGreaterThan(0);
      expect(rule.testCoverage.length).toBeGreaterThan(0);
    }
  });

  it("CSRF-001: auth/login is exempt; business mutations are not", () => {
    expect(isBffCsrfExempt("auth/login")).toBe(true);
    expect(isBffCsrfExempt("inventory/items")).toBe(false);
    expect(isBffCsrfExempt("work-orders/abc")).toBe(false);
  });

  it("CSRF-002 / CSRF-003: forgot-password and webhook prefix exemptions", () => {
    expect(isBffCsrfExempt("auth/forgot-password")).toBe(true);
    expect(isBffCsrfExempt("billing/webhooks/")).toBe(true);
    expect(isBffCsrfExempt("billing/invoices")).toBe(false);
  });

  it("AUTH-STORAGE-001: session cookies are HttpOnly with Lax SameSite", () => {
    process.env.NODE_ENV = "development";
    delete process.env.COOKIE_SECURE;
    delete process.env.ALLOW_INSECURE_HTTP;
    const opts = sessionCookieOptions(900);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.path).toBe("/");
    expect(opts.secure).toBe(false);
  });

  it("AUTH-STORAGE-002: CSRF cookie is readable; Secure follows runtime config", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "true";
    process.env.ALLOW_INSECURE_HTTP = "false";
    const csrf = csrfCookieOptions(3600);
    expect(csrf.httpOnly).toBe(false);
    expect(csrf.sameSite).toBe("lax");
    expect(csrf.secure).toBe(true);

    process.env.COOKIE_SECURE = "false";
    process.env.ALLOW_INSECURE_HTTP = "true";
    const httpMode = csrfCookieOptions(3600);
    expect(httpMode.secure).toBe(false);
  });
});
