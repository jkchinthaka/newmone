import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicAppPath, unauthenticatedLoginRedirect } from "../protected-route";
import { useIpv4Loopback } from "../bff-upstream-url";

describe("unauthenticated protected routes", () => {
  it("sends the root route without a session to login", () => {
    assert.equal(unauthenticatedLoginRedirect("/", "", false), "/login");
    assert.equal(isPublicAppPath("/"), false);
  });

  it("lets a session cookie open the root route for role resolution", () => {
    assert.equal(unauthenticatedLoginRedirect("/", "", true), null);
  });

  it("sends a retired splash bookmark without a session to login", () => {
    assert.equal(unauthenticatedLoginRedirect("/splash", "", false), "/login");
    assert.equal(unauthenticatedLoginRedirect("/splash", "?returnTo=/admin", false), "/login");
  });

  it("lets a session cookie open the retired splash route", () => {
    assert.equal(unauthenticatedLoginRedirect("/splash", "", true), null);
  });

  it("sends a retired Action Center bookmark to login without returning there", () => {
    const target = unauthenticatedLoginRedirect("/action-center", "", false);
    assert.equal(target, "/login?reason=session_expired");
    assert.equal(target?.includes("action-center"), false);
  });

  it("keeps a session cookie on the protected route", () => {
    assert.equal(unauthenticatedLoginRedirect("/action-center", "", true), null);
    assert.equal(unauthenticatedLoginRedirect("/work-orders/my", "", true), null);
  });

  it("lets the development identity probe through without a session", () => {
    assert.equal(unauthenticatedLoginRedirect("/dev/identity", "", false), null);
    assert.equal(isPublicAppPath("/dev"), false);
  });

  it("keeps password reset and invitation routes public", () => {
    assert.equal(isPublicAppPath("/forgot-password"), true);
    assert.equal(isPublicAppPath("/reset-password"), true);
    assert.equal(isPublicAppPath("/accept-invite"), true);
    assert.equal(unauthenticatedLoginRedirect("/forgot-password", "", false), null);
    assert.equal(unauthenticatedLoginRedirect("/reset-password", "?token=abc", false), null);
    assert.equal(unauthenticatedLoginRedirect("/accept-invite", "?token=abc", false), null);
  });

  it("does not redirect the login page or an external return path", () => {
    assert.equal(isPublicAppPath("/login"), true);
    assert.equal(unauthenticatedLoginRedirect("/login", "", false), null);
    assert.equal(unauthenticatedLoginRedirect("/work-orders", "?next=https://evil.example", false)?.includes("evil"), false);
  });

  it("preserves an authorized return path when the session expires", () => {
    assert.equal(
      unauthenticatedLoginRedirect("/work-orders/my", "?filter=overdue", false),
      "/login?reason=session_expired&returnTo=%2Fwork-orders%2Fmy%3Ffilter%3Doverdue"
    );
  });
});

describe("BFF loopback", () => {
  it("uses IPv4 for localhost and leaves other hosts alone", () => {
    assert.equal(new URL(useIpv4Loopback("http://localhost:3000/api/auth/login")).hostname, "127.0.0.1");
    assert.equal(new URL(useIpv4Loopback("http://api:3000/api/auth/login")).hostname, "api");
  });
});