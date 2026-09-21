import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatVehicleStatus,
  isVehicleStatus,
  resolveVehicleStatusMeta,
  UNKNOWN_VEHICLE_STATUS_META,
  VEHICLE_STATUS_META
} from "../vehicle-status";

describe("resolveVehicleStatusMeta", () => {
  it("resolves known statuses", () => {
    assert.equal(resolveVehicleStatusMeta("AVAILABLE").label, VEHICLE_STATUS_META.AVAILABLE.label);
    assert.equal(resolveVehicleStatusMeta("IN_USE").label, "In Use");
  });

  it("does not map blank/unknown DB status to AVAILABLE", () => {
    const blank = resolveVehicleStatusMeta("");
    const missing = resolveVehicleStatusMeta(null);
    const legacy = resolveVehicleStatusMeta("ACTIVE");

    assert.equal(blank.label, UNKNOWN_VEHICLE_STATUS_META.label);
    assert.equal(missing.label, UNKNOWN_VEHICLE_STATUS_META.label);
    assert.equal(legacy.label, UNKNOWN_VEHICLE_STATUS_META.label);
    assert.notEqual(blank.label, VEHICLE_STATUS_META.AVAILABLE.label);
  });

  it("isVehicleStatus rejects blank strings", () => {
    assert.equal(isVehicleStatus(""), false);
    assert.equal(isVehicleStatus("AVAILABLE"), true);
  });

  it("formatVehicleStatus stays defensive", () => {
    assert.equal(formatVehicleStatus(""), "Status not set");
    assert.equal(formatVehicleStatus("DISPOSED"), "Disposed");
  });
});
