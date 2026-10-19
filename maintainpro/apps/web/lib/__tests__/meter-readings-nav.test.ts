import test from "node:test";
import assert from "node:assert/strict";

import { EXISTING_NAV_ROUTES, NAVIGATION_ITEMS } from "../navigation";

test("meter readings sits immediately after inspections", () => {
  const inspections = NAVIGATION_ITEMS.findIndex((item) => item.id === "inspections");
  const readings = NAVIGATION_ITEMS.findIndex((item) => item.id === "meter-readings");
  assert.equal(readings, inspections + 1);
  assert.equal(NAVIGATION_ITEMS[readings]?.label, "Meter Readings");
  assert.equal(NAVIGATION_ITEMS[readings]?.href, "/utilities/readings");
  assert.equal(NAVIGATION_ITEMS[readings]?.icon, "Gauge");
  assert.equal(NAVIGATION_ITEMS[readings]?.category, "advanced");
  assert.equal(EXISTING_NAV_ROUTES.has("/utilities/readings"), true);
  assert.equal(EXISTING_NAV_ROUTES.has("/admin/assets/new"), true);
  assert.equal(EXISTING_NAV_ROUTES.has("/admin/vehicles/new"), true);
  assert.equal(EXISTING_NAV_ROUTES.has("/admin/asset-tags"), true);
});

test("utilities routes are not marked active as assets", () => {
  const source = JSON.stringify(NAVIGATION_ITEMS);
  assert.equal(source.includes("/utilities/readings"), true);
});
