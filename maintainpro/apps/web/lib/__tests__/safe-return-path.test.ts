import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPostLoginRedirect, resolveSplashDestination, safeInternalReturnPath } from "../role-redirect";

describe("safeInternalReturnPath", () => {
  it("allows an internal work-order path", () => {
    assert.equal(
      safeInternalReturnPath("/work-orders?wo=WO-2026-0012"),
      "/work-orders?wo=WO-2026-0012"
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    assert.equal(safeInternalReturnPath("https://evil.example/phish"), null);
    assert.equal(safeInternalReturnPath("//evil.example"), null);
    assert.equal(safeInternalReturnPath("/\\evil"), null);
  });

  it("rejects auth pages that would loop", () => {
    assert.equal(safeInternalReturnPath("/login"), null);
    assert.equal(safeInternalReturnPath("/forgot-password"), null);
    assert.equal(safeInternalReturnPath("/splash"), null);
  });

  it("uses a safe return path before the role landing", () => {
    assert.equal(resolveSplashDestination({ role: "ADMIN" }, "/requests"), "/requests");
    assert.equal(resolveSplashDestination({ role: "ADMIN" }, "https://evil.example"), "/action-center");
    assert.equal(resolveSplashDestination({ role: "ADMIN" }, null), getPostLoginRedirect({ role: "ADMIN" }));
  });

  it("rejects a control character that would decode into a protocol-relative URL", () => {
    assert.equal(safeInternalReturnPath("/%09/evil.example"), null);
  });
});
