import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { safeInternalReturnPath } from "../role-redirect";

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
  });
});
