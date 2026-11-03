import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { addMonthsYmd, daysLeftText, expiryIso } from "../statutory-certificates";

const src = (...parts: string[]) =>
  readFileSync(path.resolve(__dirname, "../..", ...parts), "utf8").replace(/\r\n/g, "\n");

test("expiry suggestion adds whole months and rejects non-dates", () => {
  assert.equal(addMonthsYmd("2026-10-31", 12), "2027-10-31");
  assert.equal(addMonthsYmd("2026-10-31", 6), "2027-05-01");
  assert.equal(addMonthsYmd("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonthsYmd("", 12), "");
  assert.equal(addMonthsYmd("31/10/2026", 12), "");
});

test("a certificate runs to the end of its expiry day in Sri Lanka", () => {
  assert.equal(expiryIso("2026-11-30"), "2026-11-30T18:29:00.000Z");
});

test("days left text is plain", () => {
  assert.equal(daysLeftText(5), "5 days left");
  assert.equal(daysLeftText(1), "1 day left");
  assert.equal(daysLeftText(0), "Expires today");
  assert.equal(daysLeftText(-3), "3 days overdue");
});

test("compliance page shows equipment certificates, and only managers can add or renew", () => {
  const page = src("app", "(dashboard)", "compliance", "page.tsx");
  assert.match(page, /<StatutoryCertificates \/>/);
  const component = src("components", "compliance", "statutory-certificates.tsx");
  assert.match(component, /const canEdit = CERTIFICATE_WRITE_ROLES\.includes\(getStoredRole\(\)\)/);
  assert.match(component, /\{adding && canEdit \?/);
  assert.match(component, /\.\.\.\(canEdit/);
});

test("the machine picker searches assets with the search parameter, not q", () => {
  const component = src("components", "compliance", "statutory-certificates.tsx");
  assert.match(component, /endpoint="\/assets"\n\s+searchParam="search"/);
  assert.match(component, /pageSizeParam="limit"/);
});
