import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { acceptReadingDraft, readingFieldError } from "../meter-reading-input";
import {
  HIGH_USAGE_COPY,
  averageDailyUse,
  formatMeterQuantity,
  groupReading,
  lastSevenSpark,
  liveUsageWarning,
  meterNormalRange,
  myRecentReadings,
  readingListStatus,
  savedReadingMessage,
  usagePreview
} from "../meter-readings-display";

const now = new Date("2026-10-22T03:00:00.000Z");

describe("meter readings display", () => {
  it("keeps numeric parsing strict for partial text and scientific notation", () => {
    assert.ok(readingFieldError("12abc", 3));
    assert.ok(readingFieldError("1e2", 3));
    assert.deepEqual(acceptReadingDraft("45", "12abc", 3), { value: "45", rejected: true });
    assert.deepEqual(acceptReadingDraft("4", "1e2", 0), { value: "4", rejected: true });
    assert.equal(readingFieldError("45392", 0), null);
    assert.equal(groupReading("45392"), "45,392");
    assert.equal(groupReading("12.5"), "12.5");
    assert.equal(groupReading("12."), "12.");
  });

  it("shows the 3× warning and still describes a saveable reading", () => {
    assert.equal(liveUsageWarning(810, [180, 170, 176]), HIGH_USAGE_COPY);
    assert.equal(liveUsageWarning(182, [180, 170, 176]), null);
    assert.match(HIGH_USAGE_COPY, /you can still save it/);
    const history = [{ readingValue: 45210, readingDate: "2026-10-22T02:00:00.000Z", consumption: 180, notes: "" }];
    assert.equal(usagePreview("46020", 0, history[0], history)?.warning, HIGH_USAGE_COPY);
    assert.equal(usagePreview("45392", 0, history[0], history)?.warning, null);
    assert.equal(usagePreview("45000", 0, history[0], history), null);
  });

  it("hides average, spark, and normal range when the payloads cannot support them", () => {
    assert.equal(meterNormalRange(), null);
    assert.equal(averageDailyUse([]), null);
    assert.equal(
      averageDailyUse([{ readingValue: 10, readingDate: "2026-10-22T02:00:00.000Z", consumption: 10 }]),
      null
    );
    assert.equal(
      averageDailyUse([
        { readingValue: 20, readingDate: "2026-10-22T02:00:00.000Z", consumption: 10 },
        { readingValue: 10, readingDate: "2026-10-22T02:00:00.000Z", consumption: 10 }
      ]),
      null
    );
    assert.equal(lastSevenSpark([{ readingValue: 10, readingDate: "2026-10-22T02:00:00.000Z", consumption: 4 }]), null);
    const spanned = [
      { readingValue: 20, readingDate: "2026-10-22T02:00:00.000Z", consumption: 10 },
      { readingValue: 10, readingDate: "2026-10-20T02:00:00.000Z", consumption: 10 }
    ];
    assert.equal(averageDailyUse(spanned), 10);
    assert.equal(lastSevenSpark(spanned)?.length, 2);
    assert.equal(formatMeterQuantity(8904, "m3"), "8,904 m³");
  });

  it("marks only the user's last 7 days and flags a high-usage row from older readings", () => {
    const rows = [
      { id: "new", meterId: "m", readingValue: 30, readingDate: "2026-10-22T02:00:00.000Z", consumption: 20, notes: "[by:user]" },
      { id: "old", meterId: "m", readingValue: 10, readingDate: "2026-10-01T02:00:00.000Z", consumption: 2, notes: "[by:user]" },
      { id: "other", meterId: "m", readingValue: 12, readingDate: "2026-10-21T02:00:00.000Z", consumption: 2, notes: "[by:someone]" }
    ];
    assert.deepEqual(myRecentReadings(rows, "user", now).map((row) => row.id), ["new"]);
    const history = [
      rows[0],
      { meterId: "m", readingValue: 10, readingDate: "2026-10-21T02:00:00.000Z", consumption: 2, notes: "" },
      { meterId: "m", readingValue: 8, readingDate: "2026-10-20T02:00:00.000Z", consumption: 2, notes: "" }
    ];
    assert.equal(readingListStatus(history[0], history), "HIGH_USAGE");
    assert.equal(readingListStatus(history[1], history), "SAVED");
    assert.equal(
      savedReadingMessage("M-WTR-0007", "8904", "m3", "2026-10-21T11:40:00.000Z", now),
      "Reading saved for M-WTR-0007 · 8,904 m³ · Yesterday 17:10"
    );
  });
});
