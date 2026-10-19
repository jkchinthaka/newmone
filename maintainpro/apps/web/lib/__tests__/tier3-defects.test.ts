import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatEmployeeOptionLabel } from "../workforce-designations";
import { formatRemainingDays } from "../work-order-queue-nav";
import { disableSubmitControl } from "../submit-lock";

describe("QA-FRESH-MAINT-043", () => {
  it("omits blank dashes and negative day text", () => {
    const label = formatEmployeeOptionLabel({ fullName: "Sam", availabilityLabel: null, workloadPercentage: null });
    assert.equal(label.includes("— —"), false);
    assert.equal(formatRemainingDays(-1), "1 day overdue");
    assert.equal(formatRemainingDays(-1).includes("-1"), false);
  });
});

describe("QA-FRESH-MAINT-046", () => {
  it("disables the submit button in the click handler", () => {
    const button = { disabled: false };
    disableSubmitControl(button);
    assert.equal(button.disabled, true);
  });
});
