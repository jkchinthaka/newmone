import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const page = readFileSync(path.resolve(__dirname, "../../components/assets/assets-management-page.tsx"), "utf8");

test("Machines & Equipment: status filter lives under More filters (the count buttons already filter by status)", () => {
  const more = page.indexOf('<div className="grid gap-2 border-t border-slate-200 p-3');
  assert.ok(more > 0);
  assert.ok(page.indexOf('aria-label="Status"') > more, "Status select should be under More filters");
  assert.ok(page.indexOf("aria-pressed={filters.status === status}") > 0);
});

test("Machines & Equipment: Clear shows only when a filter is set, and no developer wording remains", () => {
  assert.match(page, /filters\.search \|\| searchDraft \?/);
  assert.doesNotMatch(page, /Server-side search/);
});
