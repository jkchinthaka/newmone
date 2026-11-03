import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { primaryWorkOrderAction, secondaryWorkOrderActions } from "../work-order-next-action";

/**
 * The button a role sees on a job must be an action the API lets that role do.
 * Reads the real controller so the two cannot drift apart unnoticed.
 */
const controller = readFileSync(path.resolve(__dirname, "../../../api/src/modules/work-orders/work-orders.controller.ts"), "utf8");
const governance = readFileSync(path.resolve(__dirname, "../../../api/src/common/utils/work-order-governance.ts"), "utf8");

function rolesOf(route: string): Set<string> {
  const at = controller.indexOf(`"${route}"`);
  assert.ok(at > 0, `${route} route found`);
  const decorators = controller.slice(at, at + 500);
  const roles = decorators.match(/@Roles\(([^)]*)\)/)?.[1] ?? "";
  if (roles.includes("SUPERVISOR_ROLE_NAMES")) {
    const list = governance.match(/SUPERVISOR_ROLE_NAMES = \[([\s\S]*?)\] as const/)?.[1] ?? "";
    return new Set([...list.matchAll(/RoleName\.([A-Z_]+)/g)].map((m) => m[1]));
  }
  return new Set([...roles.matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]));
}

const ENDPOINT_FOR: Record<string, string> = {
  assign: ":id/assign",
  start: ":id/start",
  resume: ":id/resume",
  complete: ":id/complete-technician",
  "verify-close": ":id/verify-supervisor",
  close: ":id/close",
  "send-back": ":id/reject-supervisor"
};

const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER", "TECHNICIAN", "MECHANIC"];
const STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "VERIFIED", "REWORK_REQUIRED"];

test("every primary and secondary job button a role sees maps to an API route that role is allowed to call", () => {
  let checked = 0;
  for (const role of ROLES) {
    for (const status of STATUSES) {
      const actions = [primaryWorkOrderAction({ status, role, approvalStatus: "APPROVED" }), ...secondaryWorkOrderActions({ status, role })];
      for (const action of actions) {
        if (!action) continue;
        const endpoint = ENDPOINT_FOR[action.id];
        assert.ok(endpoint, `no endpoint mapped for ${action.id}`);
        assert.ok(rolesOf(endpoint).has(role), `${role} sees "${action.label}" on ${status} but ${endpoint} does not allow ${role}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked >= 20, `expected a meaningful number of checks, got ${checked}`);
});
