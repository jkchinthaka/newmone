import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  comparableConsumptions,
  consumptionWarning,
  meterFractionDigits,
  acceptReadingDraft,
  readingFieldError
} from "../meter-reading-input";

describe("meter reading input", () => {
  it("rejects letters, signs, and scientific notation", () => {
    assert.equal(readingFieldError("12abc", 3), "Enter a numeric reading of zero or greater. Letters and scientific notation are not allowed.");
    assert.ok(readingFieldError("1e2", 3));
    assert.ok(readingFieldError("-4", 3));
    assert.equal(readingFieldError("12.50", 3), null);
    assert.deepEqual(acceptReadingDraft("12", "12abc", 3), { value: "12", rejected: true });
    assert.deepEqual(acceptReadingDraft("", "12abc", 3), { value: "", rejected: true });
    assert.deepEqual(acceptReadingDraft("1", "1e2", 3), { value: "1", rejected: true });
    assert.deepEqual(acceptReadingDraft("12", "12.5", 0), { value: "12", rejected: true });
    assert.deepEqual(acceptReadingDraft("", "12.50", 3), { value: "12.50", rejected: false });
  });

  it("uses meter units for decimal places and ignores readings before a reset", () => {
    assert.equal(meterFractionDigits("kWh", "ELECTRICITY"), 3);
    assert.equal(meterFractionDigits("pulse", "WATER"), 0);
    assert.equal(
      comparableConsumptions([
        { consumption: 2, notes: "" },
        { consumption: 9, notes: "[reset:replaced]" },
        { consumption: 40, notes: "" }
      ]).join(","),
      "2"
    );
    assert.match(consumptionWarning(30, [2, 2, 2]) ?? "", /three times/);
    assert.equal(consumptionWarning(4, [2, 2, 2]), null);
  });
});