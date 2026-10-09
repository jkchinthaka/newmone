import assert from "node:assert/strict";
import test from "node:test";

import {
  FLEET_EMPTY,
  fleetKpiTarget,
  fleetNextAction,
  fleetSearch,
  fleetServiceLabel,
  fleetStateFromSearch,
  fleetVehicleHref
} from "../fleet-workspace";

test("fleet tabs and filters survive a refresh", () => {
  const state = fleetStateFromSearch(new URLSearchParams("view=gate&state=blocked&q=WP&page=2&pageSize=50"));
  assert.equal(state.view, "gate");
  assert.equal(state.gate, "blocked");
  assert.equal(state.page, 2);
  assert.equal(state.pageSize, 50);
  assert.equal(fleetSearch(state), "view=gate&q=WP&state=blocked&page=2&pageSize=50");
});

test("KPI clicks open the matching filtered view", () => {
  assert.equal(fleetSearch(fleetKpiTarget("overdue")), "service=overdue");
  assert.equal(fleetSearch(fleetKpiTarget("due")), "service=due-soon");
  assert.equal(fleetSearch(fleetKpiTarget("docs")), "view=compliance&expiry=30d");
  assert.equal(fleetSearch(fleetKpiTarget("gate")), "view=gate&state=blocked");
  assert.equal(fleetSearch(fleetKpiTarget("repairs")), "view=accidents&repair=open");
  assert.equal(fleetSearch(fleetKpiTarget("out")), "status=OUT_OF_SERVICE");
});

test("unknown view falls back to vehicles and empty copy stays exact", () => {
  assert.equal(fleetStateFromSearch(new URLSearchParams("view=tyres")).view, "vehicles");
  assert.equal(FLEET_EMPTY, "No fleet records match these filters.");
});

test("next action and vehicle route follow the row", () => {
  const now = new Date("2026-10-09T00:00:00.000Z");
  assert.equal(fleetNextAction({ nextServiceDate: "2026-10-01", now }), "Service overdue");
  assert.equal(fleetNextAction({ nextServiceDate: "2026-10-20", now }), "Due soon");
  assert.equal(fleetNextAction({ insuranceExpiry: "2026-10-20", now }), "Document expiry");
  assert.equal(fleetNextAction({ status: "OUT_OF_SERVICE", now }), "Out of service");
  assert.equal(fleetNextAction({ status: "AVAILABLE", now }), "Ready");
  assert.equal(fleetServiceLabel("ON_SCHEDULE", "2026-09-01", now), "Overdue");
  assert.equal(fleetServiceLabel("OVERDUE", null, now), "Current");
  assert.equal(fleetSearch(fleetKpiTarget("overdue", 50)), "service=overdue&pageSize=50");
  assert.equal(fleetVehicleHref("veh-1"), "/vehicles/veh-1");
});
