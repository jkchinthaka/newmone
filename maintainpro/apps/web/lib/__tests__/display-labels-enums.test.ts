import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatDisplayValue, isEnumCode, toEnumOptions } from "../display-labels";
import { formatReportValue } from "../../components/reports/api";

describe("Centralized enum display labels", () => {
  it("never shows the raw codes called out in QA", () => {
    assert.equal(formatDisplayValue("IN_PROGRESS"), "In Progress");
    assert.equal(formatDisplayValue("OUT_OF_STOCK"), "Out of stock");
    assert.equal(formatDisplayValue("TECHNICIAN_COMPLETED"), "Technician completed");
  });

  it("keeps option values raw but labels business-friendly", () => {
    assert.deepEqual(toEnumOptions(["IN_PROGRESS", "OPEN"]), [
      { id: "IN_PROGRESS", label: "In Progress" },
      { id: "OPEN", label: "Open" }
    ]);
  });

  it("does not rewrite names, tags, currency or registrations", () => {
    for (const value of ["LKR", "AST-1001", "MH-01-AB-101", "Sample Asset 1", "Plant A"]) {
      assert.equal(isEnumCode(value), false, value);
      assert.equal(formatDisplayValue(value), value);
    }
  });

  it("report table cells format enum strings", () => {
    assert.equal(formatReportValue("OUT_OF_STOCK"), "Out of stock");
    assert.equal(formatReportValue("Sample Asset 1"), "Sample Asset 1");
    assert.equal(formatReportValue(5, "number"), "5");
  });
});
