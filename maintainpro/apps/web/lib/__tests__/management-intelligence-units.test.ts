import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatMetricValue, formatSummaryCardSubLabel, formatSummaryCardValue } from "../management-intelligence-api";

describe("Management Intelligence units", () => {
  it("does not render downtime or counts as LKR", () => {
    const downtime = formatSummaryCardValue({ key: "downtime-hours", label: "Downtime hours", value: 0, unit: "hours" });
    const repeated = formatSummaryCardValue({ key: "repeated-breakdowns", label: "Repeated breakdowns", value: 1, unit: "count" });
    const reviews = formatSummaryCardValue({ key: "repair-vs-replace", label: "Repair vs replace reviews", value: 1, unit: "count" });
    assert.equal(downtime, "0 h");
    assert.equal(repeated, "1");
    assert.equal(reviews, "1");
    for (const text of [downtime, repeated, reviews]) assert.equal(/LKR|Rs/.test(text), false, text);
  });

  it("falls back by key when an older API omits unit — never to currency for counts", () => {
    assert.equal(formatSummaryCardValue({ key: "repeated-breakdowns", label: "x", value: 1 }), "1");
    assert.equal(formatSummaryCardValue({ key: "downtime-hours", label: "x", value: 2.5 }), "2.5 h");
    assert.match(formatSummaryCardValue({ key: "total-cost", label: "x", value: 1200 }), /LKR|Rs/);
  });

  it("formats the top-department amount as currency, not a bare number", () => {
    assert.match(
      String(formatSummaryCardSubLabel({ key: "top-department", label: "x", value: "Plant", unit: "text", subValue: 5000, subUnit: "currency" })),
      /LKR|Rs/
    );
    assert.equal(formatMetricValue("Unassigned department", "text"), "Unassigned department");
  });
});
