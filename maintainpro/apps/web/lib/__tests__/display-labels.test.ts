import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatEnumLabel,
  formatReportCoverageNote,
  formatRequiredChecksAttention
} from "../display-labels";
import { getFacilityLevelSingularLabel } from "../facilities";

test("formatEnumLabel maps common workflow codes", () => {
  assert.equal(formatEnumLabel("IN_PROGRESS"), "In Progress");
  assert.equal(formatEnumLabel("INSUFFICIENT_DATA"), "Insufficient data");
});

test("formatReportCoverageNote rewrites developer jargon", () => {
  const note = "Failed login attempts are persisted as SecurityEvent records without passwords.";
  assert.match(formatReportCoverageNote(note), /security audit log/i);
  assert.doesNotMatch(formatReportCoverageNote(note), /SecurityEvent/);
});

test("formatRequiredChecksAttention uses singular and plural grammar", () => {
  assert.equal(formatRequiredChecksAttention(1), "1 required dependency check needs attention.");
  assert.equal(formatRequiredChecksAttention(2), "2 required dependency checks need attention.");
});

test("getFacilityLevelSingularLabel avoids Properties -> Propertie typo", () => {
  assert.equal(getFacilityLevelSingularLabel("property"), "Property");
  assert.equal(getFacilityLevelSingularLabel("building"), "Building");
});
