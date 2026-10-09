import assert from "node:assert/strict";
import test from "node:test";

import {
  GATE_EMPTY,
  gateActionForStatus,
  gateDeskFromSearch,
  gateDeskSearch,
  gateListStatus,
  gateMeterError,
  gatePresenceLabel,
  gateReasonHref,
  splitGateReasons
} from "../gate-operations";

test("gate desk URL keeps the selected vehicle", () => {
  const state = gateDeskFromSearch(new URLSearchParams("vehicle=veh-1&presence=inside&q=MH&page=2&pageSize=50"));
  assert.equal(state.vehicleId, "veh-1");
  assert.equal(state.presence, "inside");
  assert.equal(gateDeskSearch(state), "q=MH&presence=inside&vehicle=veh-1&page=2&pageSize=50");
  assert.equal(gateListStatus(state), "AVAILABLE");
  assert.equal(GATE_EMPTY, "No fleet records match these filters.");
});

test("only Available can gate out and only In Use can gate in", () => {
  assert.equal(gateActionForStatus("AVAILABLE"), "out");
  assert.equal(gateActionForStatus("IN_USE"), "in");
  assert.equal(gateActionForStatus("OUT_OF_SERVICE"), null);
  assert.equal(gatePresenceLabel("AVAILABLE"), "Inside");
  assert.equal(gatePresenceLabel("IN_USE"), "Outside");
});

test("meter rules match the server: blank, junk, negative, and rollback fail; equal and higher pass", () => {
  assert.equal(gateMeterError("", 100), "Enter a meter reading.");
  assert.equal(gateMeterError("abc", 100), "Meter reading must be a number.");
  assert.equal(gateMeterError("-1", 100), "Meter reading cannot be negative.");
  assert.match(gateMeterError("99", 100) ?? "", /lower/);
  assert.equal(gateMeterError("100", 100), null);
  assert.equal(gateMeterError("150", 100), null);
});

test("blocking reasons link to the related record", () => {
  assert.deepEqual(splitGateReasons("Vehicle service is overdue; Missing required document: INSURANCE"), [
    "Vehicle service is overdue",
    "Missing required document: INSURANCE"
  ]);
  assert.equal(gateReasonHref("Vehicle service is overdue", "veh-1", "MH-01"), "/vehicles/veh-1");
  assert.equal(gateReasonHref("Missing required document: INSURANCE", "veh-1", "MH-01"), "/fleet?view=compliance&q=MH-01");
  assert.equal(
    gateReasonHref("Critical open work order WO-2026-00012 (ACCIDENT_REPAIR, OPEN)", "veh-1", "MH-01"),
    "/work-orders?q=WO-2026-00012"
  );
});
