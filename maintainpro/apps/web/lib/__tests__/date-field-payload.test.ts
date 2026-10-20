import assert from "node:assert/strict";
import test from "node:test";

import { parseTypedDate, parseTypedTime, colomboDateTimeToIso } from "../colombo-datetime";
import { EXPECTED_COMPLETION_AFTER_DUE, createScheduleIssues } from "../../../../packages/shared-types/src/work-order-schedule";

test("typed dates normalise to yyyy-mm-dd and the schedule helper rejects a later expected date", () => {
  assert.equal(parseTypedDate("16/10/2026"), "2026-10-16");
  assert.equal(
    createScheduleIssues({
      dueDate: "2026-10-20",
      expectedCompletionDate: "2026-10-21",
      today: "2026-10-16"
    }).expectedCompletionDate,
    EXPECTED_COMPLETION_AFTER_DUE
  );
  assert.equal(
    createScheduleIssues({
      dueDate: "2026-10-20",
      expectedCompletionDate: "2026-10-20",
      today: "2026-10-16"
    }).expectedCompletionDate,
    undefined
  );
});

test("date, time, and date-time field values keep the existing payload shapes", () => {
  assert.equal(parseTypedDate("16 Oct 2026"), "2026-10-16");
  assert.equal(parseTypedTime("2:30 PM"), "14:30");
  assert.equal(colomboDateTimeToIso("2026-10-16", "14:30"), "2026-10-16T09:00:00.000Z");
});
