import assert from "node:assert/strict";
import test from "node:test";

import { pmPlanDraftError, pmPlanListParams, pmPlanStateFromSearch } from "../pm-plan-list";

test("create PM draft rejects a blank name, a zero interval, and activation without an asset", () => {
  assert.match(pmPlanDraftError({
    name: "  ",
    assetId: "",
    vehicleId: "",
    trigger: "CALENDAR",
    intervalDays: "30",
    intervalValue: "",
    activate: false
  }) ?? "", /plan name/);
  assert.match(pmPlanDraftError({
    name: "Oil change",
    assetId: "",
    vehicleId: "",
    trigger: "CALENDAR",
    intervalDays: "0",
    intervalValue: "",
    activate: false
  }) ?? "", /greater than 0/);
  assert.match(pmPlanDraftError({
    name: "Oil change",
    assetId: "",
    vehicleId: "",
    trigger: "CALENDAR",
    intervalDays: "30",
    intervalValue: "",
    activate: true
  }) ?? "", /asset or vehicle/);
  assert.equal(pmPlanDraftError({
    name: "Oil change",
    assetId: "asset-1",
    vehicleId: "",
    trigger: "CALENDAR",
    intervalDays: "30",
    intervalValue: "",
    activate: true
  }), null);
});

test("PM filters survive the URL and request the same due window", () => {
  const state = pmPlanStateFromSearch(new URLSearchParams("status=ACTIVE&due=overdue&q=pump&trigger=CALENDAR&page=2"));
  assert.equal(state.status, "ACTIVE");
  assert.equal(state.due, "overdue");
  assert.equal(state.page, 2);
  const params = pmPlanListParams(state);
  assert.equal(params.status, "ACTIVE");
  assert.equal(params.dueWindow, "overdue");
  assert.equal(params.search, "pump");
  assert.equal(params.trigger, "CALENDAR");
  assert.equal(params.page, 2);
  const legacy = pmPlanStateFromSearch(new URLSearchParams("view=attention"));
  assert.equal(pmPlanListParams(legacy).dueWindow, "attention");
  const legacyDue = pmPlanStateFromSearch(new URLSearchParams("view=due"));
  assert.equal(pmPlanListParams(legacyDue).dueWindow, "7");
});

test("clearing filters returns the first unfiltered page", () => {
  const cleared = pmPlanStateFromSearch(new URLSearchParams(""));
  const params = pmPlanListParams(cleared);
  assert.equal(params.status, undefined);
  assert.equal(params.dueWindow, undefined);
  assert.equal(params.page, 1);
  assert.equal(params.search, undefined);
});
