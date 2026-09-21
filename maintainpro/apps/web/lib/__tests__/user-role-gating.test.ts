import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { USER_KEY } from "../auth-storage";
import {
  canReadFleetLiveMap,
  canReadInventoryAnalytics,
  FLEET_LIVE_MAP_ROLES,
  INVENTORY_ANALYTICS_ROLES
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
