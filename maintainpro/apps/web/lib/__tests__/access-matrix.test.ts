import assert from "node:assert/strict";
import test from "node:test";

import { accessMatrixCell, isRoleLimitedPermission } from "../access-matrix";

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
