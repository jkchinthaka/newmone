import assert from "node:assert/strict";
import test from "node:test";

import { accessMatrixCell, activeOverrideEffect, isRoleLimitedPermission } from "../access-matrix";

test("expired overrides do not change the effective matrix state", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  assert.equal(activeOverrideEffect({ effect: "DENY", expiresAt: "2026-10-22T12:00:00Z" }, now), null);
  assert.equal(activeOverrideEffect({ effect: "GRANT", expiresAt: "2026-10-22T13:00:00Z" }, now), "GRANT");
  assert.equal(activeOverrideEffect({ effect: "DENY", expiresAt: null }, now), "DENY");
});

test("studio off keeps the role grant label", () => {
  assert.equal(accessMatrixCell(true, null, false), "Granted");
  assert.equal(accessMatrixCell(false, "GRANT", false), "Not granted");
  assert.equal(accessMatrixCell(true, "DENY", false), "Granted");
});

test("studio on shows inherited, granted, and denied", () => {
  assert.equal(accessMatrixCell(true, null, true), "Inherited");
  assert.equal(accessMatrixCell(false, "GRANT", true), "Granted");
  assert.equal(accessMatrixCell(true, "GRANT", true), "Granted");
  assert.equal(accessMatrixCell(true, "DENY", true), "Denied");
  assert.equal(accessMatrixCell(false, null, true), "Not granted");
});

test("role-limited keys match the service checks and ignore other keys", () => {
  assert.equal(isRoleLimitedPermission("work_orders.verify"), true);
  assert.equal(isRoleLimitedPermission("vendor.manage"), true);
  assert.equal(isRoleLimitedPermission("dashboard.view"), false);
});
