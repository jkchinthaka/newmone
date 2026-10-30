import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const src = readFileSync(path.resolve(__dirname, "../../components/reliability/reliability-workbench.tsx"), "utf8");

test("Why-it-broke list: search and status up front; owner and sort sit under More filters", () => {
  const block = src.slice(src.indexOf('placeholder="Search why it broke'));
  const more = block.indexOf("More filters");
  assert.ok(more > 0);
  assert.ok(block.indexOf('aria-label="Status"') < more, "Status stays visible");
  for (const label of ['aria-label="Owner"', 'aria-label="Sort"']) {
    assert.ok(block.indexOf(label) > more, `${label} should be under More filters`);
  }
  assert.match(block, /open=\{Boolean\(owner\) \|\| Boolean\(sort\)\}/, "panel opens itself when a hidden filter is active");
});
