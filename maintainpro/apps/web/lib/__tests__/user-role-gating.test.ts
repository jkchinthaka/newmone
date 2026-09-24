import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { USER_KEY } from "../auth-storage";
import {
  canCreateWorkOrder,
  canReadFleetLiveMap,
  canReadInventoryAnalytics,
  FLEET_LIVE_MAP_ROLES,
  INVENTORY_ANALYTICS_ROLES,
  WORK_ORDER_CREATE_ROLES,
  WORK_ORDERS_MANAGE_PERMISSION
} from "../user-role";

function stubUser(payload: unknown) {
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => (key === USER_KEY ? JSON.stringify(payload) : null)
    }
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("canReadInventoryAnalytics", () => {
  it("allows roles that match the API analytics @Roles when permissions are empty (JWT may omit them)", () => {
    stubUser({ role: "ADMIN", permissions: [] });
    assert.equal(canReadInventoryAnalytics(), true);
  });

  it("denies MANAGER — distinguishes not-authorized from empty analytics data", () => {
    stubUser({ role: "MANAGER", permissions: ["inventory.manage"] });
    assert.equal(canReadInventoryAnalytics(), false);
    assert.equal(INVENTORY_ANALYTICS_ROLES.includes("MANAGER"), false);
  });

  it("denies an allowed role that explicitly lacks inventory.manage", () => {
    stubUser({ role: "MECHANIC", permissions: ["work_orders.read"] });
    assert.equal(canReadInventoryAnalytics(), false);
  });

  it("allows MECHANIC with inventory.manage", () => {
    stubUser({ role: "MECHANIC", permissions: ["inventory.manage"] });
    assert.equal(canReadInventoryAnalytics(), true);
  });
});

describe("canReadFleetLiveMap", () => {
  it("mirrors GET /fleet/live-map roles and excludes MANAGER", () => {
    assert.equal(FLEET_LIVE_MAP_ROLES.includes("MANAGER"), false);
    stubUser({ role: "MANAGER" });
    assert.equal(canReadFleetLiveMap(), false);
  });

  it("allows SUPERVISOR for live map", () => {
    stubUser({ role: "SUPERVISOR" });
    assert.equal(canReadFleetLiveMap(), true);
  });
});

describe("canCreateWorkOrder (UI/API create RBAC)", () => {
  it("allows manager/admin create roles with work_orders.manage", () => {
    for (const role of WORK_ORDER_CREATE_ROLES) {
      assert.equal(
        canCreateWorkOrder(role, [WORK_ORDERS_MANAGE_PERMISSION]),
        true,
        `${role} should create`
      );
    }
  });

  it("hides create for technician/mechanic/supervisor even with manage permission", () => {
    for (const role of ["TECHNICIAN", "MECHANIC", "SUPERVISOR", "VIEWER"] as const) {
      assert.equal(
        canCreateWorkOrder(role, [WORK_ORDERS_MANAGE_PERMISSION]),
        false,
        `${role} must not see Create Work Order`
      );
    }
  });

  it("denies create-capable role that lacks work_orders.manage when permissions are known", () => {
    assert.equal(canCreateWorkOrder("MANAGER", ["work_orders.view"]), false);
  });

  it("allows create-capable role when /auth/me permissions list is empty (DB resolves grant)", () => {
    stubUser({ role: "MANAGER", permissions: [] });
    assert.equal(canCreateWorkOrder(), true);
  });

  it("does not treat unauthorized roles as create-capable", () => {
    assert.equal(WORK_ORDER_CREATE_ROLES.includes("TECHNICIAN"), false);
    assert.equal(WORK_ORDER_CREATE_ROLES.includes("SUPERVISOR"), false);
  });
});
