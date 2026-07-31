import { AuthController } from "../src/modules/auth/auth.controller";
import {
  BROWSER_SESSION_COOKIE_NAMES,
  NEST_AUTH_COOKIE_SAME_SITE,
  NEST_ISSUES_BROWSER_SESSION_COOKIES
} from "../src/modules/auth/auth-cookie.policy";
import { TenancyController } from "../src/modules/tenancy/tenancy.controller";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("Nest cookie ownership (COOKIE-CLOSE / Option A)", () => {
  it("COOKIE-CLOSE-005: Nest policy forbids issuing browser session cookies and SameSite=None", () => {
    expect(NEST_ISSUES_BROWSER_SESSION_COOKIES).toBe(false);
    expect(NEST_AUTH_COOKIE_SAME_SITE).toBe("lax");
    expect([...BROWSER_SESSION_COOKIE_NAMES]).toEqual([
      "maintainpro_access",
      "maintainpro_refresh",
      "maintainpro_csrf"
    ]);
  });

  it("COOKIE-CLOSE-002/007: auth controller source does not call res.cookie for session cookies", () => {
    const source = readFileSync(
      path.join(__dirname, "../src/modules/auth/auth.controller.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/res\.cookie\s*\(/);
    expect(source).not.toMatch(/sameSite\s*=\s*secure\s*\?\s*\(\s*"none"/);
    expect(source).not.toMatch(/"none"\s*as\s*const/);
    expect(source).toMatch(/clearAuthCookies/);
  });

  it("COOKIE-CLOSE-007: tenancy switch does not Set-Cookie; returns accessToken in JSON contract", async () => {
    const source = readFileSync(
      path.join(__dirname, "../src/modules/tenancy/tenancy.controller.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/res\.cookie\s*\(/);
    expect(source).not.toMatch(/setAccessCookie/);

    const tenancyService = {
      switchTenant: jest.fn().mockResolvedValue({
        accessToken: "rotated-access-token",
        activeTenant: { id: "t1" }
      })
    };
    const controller = new TenancyController(tenancyService as any);
    const result = await controller.switchTenant({ user: { sub: "u1" } }, "t1");
    expect(result.data.accessToken).toBe("rotated-access-token");
    expect(tenancyService.switchTenant).toHaveBeenCalledWith("u1", "t1");
  });

  it("COOKIE-CLOSE-010: policy module exports contain no secret placeholders", () => {
    const source = readFileSync(
      path.join(__dirname, "../src/modules/auth/auth-cookie.policy.ts"),
      "utf8"
    );
    expect(source).not.toMatch(/JWT_|password|secret=/i);
    expect(AuthController.name).toBe("AuthController");
  });
});