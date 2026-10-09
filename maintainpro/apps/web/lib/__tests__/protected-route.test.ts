import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicAppPath, unauthenticatedLoginRedirect } from "../protected-route";
import { useIpv4Loopback } from "../bff-upstream-url";

describe("unauthenticated protected routes", () => {
  it("sends /action-center to login with a safe return path", () => {
    assert.equal(
      unauthenticatedLoginRedirect("/action-center", "", false),
      "/login?reason=session_expired&returnTo=%2Faction-center"
    );
  });

  it("keeps a session cookie on the protected route", () => {
    assert.equal(unauthenticatedLoginRedirect("/action-center", "", true), null);
  });

  it("does not redirect the login page or an external return path", () => {
    assert.equal(isPublicAppPath("/login"), true);
    assert.equal(unauthenticatedLoginRedirect("/login", "", false), null);
    assert.equal(unauthenticatedLoginRedirect("/action-center", "?next=https://evil.example", false)?.includes("evil"), false);
  });
});

describe("BFF loopback", () => {
  it("uses IPv4 for localhost and leaves other hosts alone", () => {
    assert.equal(new URL(useIpv4Loopback("http://localhost:3000/api/auth/login")).hostname, "127.0.0.1");
    assert.equal(new URL(useIpv4Loopback("http://api:3000/api/auth/login")).hostname, "api");
  });
});