import assert from "node:assert/strict";
import test from "node:test";

import { canAccessNavigationPath, getVisibleNavigationItems } from "../navigation";
import { hasCompatiblePermission } from "../permission-aliases";

// Seeded MANAGER has work_orders.manage but not approvals.view; the API accepts the alias.
const MANAGER_KEYS = ["dashboard.view", "work_orders.manage", "maintenance_requests.view_all", "maintenance_requests.create"];

test("a manager approver sees and can open Approvals through the same alias the API accepts", () => {
  const visible = getVisibleNavigationItems("MANAGER", { permissions: MANAGER_KEYS }).map((item) => item.href);
  assert.equal(visible.includes("/approvals"), true);
  assert.equal(canAccessNavigationPath("/approvals", "MANAGER", MANAGER_KEYS), true);
});

test("roles without the key or an alias still cannot open Approvals", () => {
  assert.equal(canAccessNavigationPath("/approvals", "MANAGER", ["dashboard.view"]), false);
  assert.equal(canAccessNavigationPath("/approvals", "TECHNICIAN", ["work_orders.view_own", "work_orders.update_status"]), false);
});

test("alias rule matches the API guard, including the SUPERVISOR verify exception", () => {
  assert.equal(hasCompatiblePermission(new Set(["work_orders.manage"]), "approvals.view", "MANAGER"), true);
  assert.equal(hasCompatiblePermission(new Set(["work_orders.manage"]), "work_orders.verify", "MANAGER"), true);
  assert.equal(hasCompatiblePermission(new Set(["work_orders.manage"]), "work_orders.verify", "SUPERVISOR"), false);
  assert.equal(hasCompatiblePermission(new Set(["work_orders.verify"]), "work_orders.verify", "SUPERVISOR"), true);
  assert.equal(hasCompatiblePermission(new Set(["assets.view"]), "approvals.view", "MANAGER"), false);
});
