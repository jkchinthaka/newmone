import assert from "node:assert/strict";
import test from "node:test";

import { calendarKeyTarget, formatCalendarDate, formatClock, formatColomboDateTime, parseTypedDate, parseTypedTime } from "../colombo-datetime";

test("calendar dates display as dd MMM yyyy and clock as hh:mm AM/PM", () => {
  assert.equal(formatCalendarDate("2026-10-16"), "16 Oct 2026");
  assert.equal(formatClock(0, 5), "12:05 AM");
  assert.equal(formatClock(14, 30), "02:30 PM");
  assert.equal(formatColomboDateTime("2026-10-16T09:00:00.000Z"), "16 Oct 2026 02:30 PM");
});

test("typed dates accept the four supported forms and reject impossible days", () => {
  assert.equal(parseTypedDate("16/10/2026"), "2026-10-16");
  assert.equal(parseTypedDate("16-10-2026"), "2026-10-16");
  assert.equal(parseTypedDate("2026-10-16"), "2026-10-16");
  assert.equal(parseTypedDate("16 Oct 2026"), "2026-10-16");
  assert.equal(parseTypedDate("31/02/2026"), null);
  assert.equal(parseTypedDate("16.10.2026"), null);
});

test("typed times accept 12-hour and 24-hour text", () => {
  assert.equal(parseTypedTime("2:30 PM"), "14:30");
  assert.equal(parseTypedTime("14:30"), "14:30");
  assert.equal(parseTypedTime("12:00 AM"), "00:00");
  assert.equal(parseTypedTime("25:00"), null);
});

test("keyboard navigation moves by day, week, and month", () => {
  assert.equal(calendarKeyTarget("2026-10-16", "ArrowLeft"), "2026-10-15");
  assert.equal(calendarKeyTarget("2026-10-16", "ArrowRight"), "2026-10-17");
  assert.equal(calendarKeyTarget("2026-10-16", "ArrowUp"), "2026-10-09");
  assert.equal(calendarKeyTarget("2026-10-16", "ArrowDown"), "2026-10-23");
  assert.equal(calendarKeyTarget("2026-10-16", "PageUp"), "2026-09-16");
  assert.equal(calendarKeyTarget("2026-10-16", "PageDown"), "2026-11-16");
  assert.equal(calendarKeyTarget("2026-10-16", "Home"), "2026-10-12");
  assert.equal(calendarKeyTarget("2026-10-16", "End"), "2026-10-18");
  assert.equal(calendarKeyTarget("2026-10-16", "Enter"), "select");
  assert.equal(calendarKeyTarget("2026-10-16", "Escape"), "close");
});
