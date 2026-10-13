import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canViewRetainedReport,
  pinReport,
  readReportPins,
  REMOVED_REPORT_SLUGS,
  reportModuleFromSearch,
  reportPinStorageKey,
  unpinReport,
  visiblePinnedReports,
  visibleReportModules,
  writeReportPins
} from "../report-workspace";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value)
  };
}

describe("retained reports", () => {
  it("offers the five operational reports and hides removed tabs", () => {
    const labels = visibleReportModules("ADMIN").map((item) => item.label);
    assert.deepEqual(labels, ["Operations", "User Activity", "Assets & Equipment", "Inventory & Parts", "System Logs"]);
    for (const slug of REMOVED_REPORT_SLUGS) {
      assert.equal(canViewRetainedReport("ADMIN", [], slug), false);
    }
  });

  it("keeps system logs off roles that only have general report access", () => {
    assert.equal(canViewRetainedReport("MANAGER", ["reports.view"], "system-logs"), false);
    assert.equal(canViewRetainedReport("ADMIN", [], "system-logs"), true);
    assert.equal(canViewRetainedReport("TECHNICIAN", ["audit.view"], "system-logs"), true);
  });

  it("does not open a removed module from the query string", () => {
    assert.equal(reportModuleFromSearch("financials", "ADMIN"), "operations");
    assert.equal(reportModuleFromSearch("performance", "FINANCE"), "operations");
    assert.equal(reportModuleFromSearch("inventory", "STOREKEEPER"), "inventory");
  });
});

describe("report pins", () => {
  it("stores up to four pins per user and tenant", () => {
    const storage = memoryStorage();
    let pins = readReportPins("user-a", "tenant-a", storage);
    for (const slug of ["operations", "assets", "inventory", "user-activity"] as const) {
      const next = pinReport(pins, slug, "ADMIN");
      assert.equal(next.ok, true);
      pins = next.ok ? next.pins : pins;
    }
    const blocked = pinReport(pins, "system-logs", "ADMIN");
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "limit");
    writeReportPins("user-a", "tenant-a", pins, storage);
    writeReportPins("user-b", "tenant-a", ["inventory"], storage);
    writeReportPins("user-a", "tenant-b", ["assets"], storage);
    assert.deepEqual(readReportPins("user-a", "tenant-a", storage), pins);
    assert.deepEqual(readReportPins("user-b", "tenant-a", storage), ["inventory"]);
    assert.deepEqual(readReportPins("user-a", "tenant-b", storage), ["assets"]);
    assert.notEqual(reportPinStorageKey("user-a", "tenant-a"), reportPinStorageKey("user-b", "tenant-a"));
  });

  it("drops a pin when permission is revoked and unpins without changing other users", () => {
    const storage = memoryStorage();
    writeReportPins("user-a", "tenant-a", ["system-logs", "operations"], storage);
    assert.deepEqual(visiblePinnedReports(readReportPins("user-a", "tenant-a", storage), "TECHNICIAN"), ["operations"]);
    const remaining = unpinReport(["operations", "assets"], "operations");
    assert.deepEqual(remaining, ["assets"]);
  });

  it("refuses a pin the role cannot open", () => {
    const result = pinReport([], "system-logs", "TECHNICIAN");
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "unavailable");
  });
});
