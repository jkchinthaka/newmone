import assert from "node:assert/strict";
import test from "node:test";

import {
  dashboardCardsForRole,
  isTechnicianMaintenanceDashboard,
  MANAGER_ACTION_CARDS,
  TECHNICIAN_ACTION_CARDS,
  WORKLOAD_CARDS
} from "../maintenance-dashboard-view";

test("manager action cards open distinct filtered work-order views", () => {
  assert.deepEqual(
    MANAGER_ACTION_CARDS.map((card) => [card.label, card.href]),
    [
      ["Overdue", "/work-orders?filter=overdue"],
      ["Unassigned", "/work-orders?filter=unassigned"],
      ["Verification Required", "/work-orders?filter=verification-required"],
      ["Waiting for Parts", "/work-orders?filter=waiting-parts"]
    ]
  );
  const hrefs = MANAGER_ACTION_CARDS.map((card) => card.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test("workload cards keep stage filters and do not link to an unfiltered board", () => {
  assert.deepEqual(
    WORKLOAD_CARDS.map((card) => card.href),
    [
      "/work-orders?filter=open",
      "/work-orders?filter=unassigned",
      "/work-orders?filter=in-progress",
      "/work-orders?filter=on-hold",
      "/work-orders?filter=verification-required"
    ]
  );
});

test("inventory keepers only see queues they are allowed to open", () => {
  assert.deepEqual(
    dashboardCardsForRole("INVENTORY_KEEPER", MANAGER_ACTION_CARDS).map((card) => card.id),
    ["unassigned", "waiting-parts"]
  );
  assert.deepEqual(
    dashboardCardsForRole("INVENTORY_KEEPER", WORKLOAD_CARDS).map((card) => card.id),
    ["open", "unassigned", "in-progress", "on-hold"]
  );
  assert.equal(dashboardCardsForRole("MANAGER", MANAGER_ACTION_CARDS).length, MANAGER_ACTION_CARDS.length);
});

test("technician dashboard is personal job filters only", () => {
  assert.equal(isTechnicianMaintenanceDashboard("TECHNICIAN"), true);
  assert.equal(isTechnicianMaintenanceDashboard("mechanic"), true);
  assert.equal(isTechnicianMaintenanceDashboard("MANAGER"), false);
  assert.equal(isTechnicianMaintenanceDashboard("ADMIN"), false);
  assert.deepEqual(
    TECHNICIAN_ACTION_CARDS.map((card) => card.href),
    [
      "/work-orders/my",
      "/work-orders/my?filter=due-today",
      "/work-orders/my?filter=overdue",
      "/work-orders/my?filter=waiting-parts"
    ]
  );
});
