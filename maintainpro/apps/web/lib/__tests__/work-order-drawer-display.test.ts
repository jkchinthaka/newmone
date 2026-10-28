import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  displayWorkOrderTitle,
  downtimeCategoryLabel,
  formatDowntimeElapsed,
  formatDrawerDateTime,
  isWorkOrderDrawerReadOnly,
  workOrderDrawerStepper
} from "../work-order-drawer-display";

describe("job drawer display", () => {
  function stepIndex(status: string) {
    const step = workOrderDrawerStepper(status);
    assert.equal(step.cancelled, false);
    if (step.cancelled) return -1;
    return step.index;
  }

  it("maps status onto the five-step progress", () => {
    assert.equal(stepIndex("OPEN"), 0);
    assert.equal(stepIndex("PLANNED"), 0);
    assert.equal(stepIndex("ASSIGNED"), 1);
    assert.equal(stepIndex("IN_PROGRESS"), 2);
    assert.equal(stepIndex("ON_HOLD"), 2);
    assert.equal(stepIndex("TECHNICIAN_COMPLETED"), 3);
    assert.equal(stepIndex("CLOSED"), 4);
    assert.equal(workOrderDrawerStepper("CANCELLED").cancelled, true);
  });

  it("cleans the display title and leaves a plain title unchanged", () => {
    assert.equal(displayWorkOrderTitle("MR-2026-00015 Gate pump leak 88421"), "Gate pump leak");
    assert.equal(displayWorkOrderTitle("MR-2026-00015 — Gate pump leak"), "Gate pump leak");
    assert.equal(displayWorkOrderTitle("Gate pump leak"), "Gate pump leak");
    assert.equal(displayWorkOrderTitle("Replace seal 35 mm"), "Replace seal 35 mm");
  });

  it("treats only closed and cancelled jobs as read-only", () => {
    assert.equal(isWorkOrderDrawerReadOnly("CLOSED"), true);
    assert.equal(isWorkOrderDrawerReadOnly("CANCELLED"), true);
    assert.equal(isWorkOrderDrawerReadOnly("IN_PROGRESS"), false);
    assert.equal(isWorkOrderDrawerReadOnly("COMPLETED"), false);
  });

  it("formats the live machine stopped time clock from the segment start", () => {
    const started = "2026-10-24T03:10:00.000Z";
    const now = Date.parse("2026-10-24T05:25:40.000Z");
    assert.equal(formatDowntimeElapsed(started, now), "02:15:40");
    assert.equal(formatDowntimeElapsed("not-a-date", now), "00:00:00");
    assert.equal(formatDowntimeElapsed(started, Date.parse(started) - 5000), "00:00:00");
  });

  it("labels machine stopped time categories and formats drawer times in Colombo", () => {
    assert.equal(downtimeCategoryLabel("BREAKDOWN"), "Breakdown");
    assert.equal(downtimeCategoryLabel("PLANNED_MAINTENANCE"), "Planned Maintenance");
    assert.equal(formatDrawerDateTime("2026-10-21T15:43:00.000Z"), "21 Oct 2026 09:13 PM");
  });
});
