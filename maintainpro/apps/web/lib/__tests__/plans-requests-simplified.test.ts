import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(path.resolve(__dirname, "../../app/(dashboard)", file), "utf8");

test("Scheduled Service: only search up front; Status, Trigger and Due window sit under More filters", () => {
  const page = read("maintenance/plans/page.tsx");
  const more = page.indexOf("{moreFilters ? (");
  assert.ok(more > 0);
  for (const label of ['aria-label="Status"', 'aria-label="Trigger type"', 'aria-label="Due window"', 'aria-label="Auto job"']) {
    assert.ok(page.indexOf(label) > more, `${label} should be under More filters`);
  }
  assert.ok(page.indexOf('aria-label="Search scheduled service plans"') < more);
  assert.match(page, /aria-pressed=\{item\.pressed\}/); // summary buttons still filter by due state
});

test("Requests list: duplicate status chip row is gone; Priority and Type are under More filters and open from the URL", () => {
  const page = read("requests/page.tsx");
  assert.doesNotMatch(page, /aria-label="Status filters"/);
  const more = page.indexOf("{advanced ? (");
  assert.ok(page.indexOf('aria-label="Priority"') > more);
  assert.ok(page.indexOf('aria-label="Type"') > more);
  assert.match(page, /useState\(Boolean\(reporter \|\| from \|\| converted \|\| priority \|\| jobDomain\)\)/);
  assert.ok(page.indexOf('aria-label="Status"') < more, "Status select stays in the main row");
});
