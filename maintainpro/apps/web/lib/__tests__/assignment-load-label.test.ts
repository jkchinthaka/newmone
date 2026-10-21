import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assignmentLoadLabel, formatEmployeeOptionLabel } from "../workforce-designations";

describe("assignment load label", () => {
  it("keeps the existing option text and adds the open-job label", () => {
    const label = formatEmployeeOptionLabel({
      fullName: "Sam",
      availabilityLabel: "Busy",
      workloadPercentage: 80,
      openJobCount: 3
    });
    assert.match(label, /Busy/);
    assert.match(label, /80% load/);
    assert.match(label, /Busy · 3 jobs/);
    assert.equal(assignmentLoadLabel(2), "Available · 2 jobs");
  });
});
